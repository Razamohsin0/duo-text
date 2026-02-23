import { Component, OnInit, ChangeDetectorRef, NgZone, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Pusher from 'pusher-js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  userName = '';
  targetUser = ''; 
  nameInput = '';
  isChatVisible = false; 
  partnerOnline = false;
  partnerStatusText = 'WAITING FOR ENCRYPTED LINK...';
  newMessage = '';
  messages: any[] = [];
  seenMessages: Set<string> = new Set(); 
  isPartnerTyping = false;
  typingTimeout: any;
  sessionTerminated = false;
  currentSessionId = Math.random().toString(36).substring(7);
  newMessagesCount = 0;
  isUserAtBottom = true;

  private pusher: any;
  private channel: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2', 
      forceTLS: true, 
      authEndpoint: '/api/pusher/auth' 
    });
  }

  setUserName() {
    if (this.nameInput.trim()) {
      const input = this.nameInput.trim().toLowerCase();
      
      if (this.userName === input) { 
        this.isChatVisible = true; 
        this.notifyPresence(true); 
        return; 
      }

      this.userName = input;
      this.isChatVisible = true;
      this.sessionTerminated = false;

      let roomID = (this.userName === 'user1' || this.userName === 'user2') ? 'private-vault-user1-user2' : 'private-public-plaza';
      this.targetUser = (this.userName === 'user1') ? 'user2' : (this.userName === 'user2' ? 'user1' : 'public_group');
      
      this.channel = this.pusher.subscribe(roomID);
      this.setupBindings();
      this.loadHistory();
      this.terminateOtherSessions(roomID);
      
      this.cdr.detectChanges();
    }
  }

  setupBindings() {
    this.channel.bind('terminate-session', (data: any) => {
      this.ngZone.run(() => {
        if (data.userName === this.userName && data.sessionId !== this.currentSessionId) {
          this.handleTermination();
        }
      });
    });

    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName && !this.messages.find(m => m.id === data.id)) {
          this.messages.push(data);
          this.messages.sort((a, b) => a.timestamp - b.timestamp);
          if (this.isUserAtBottom) { 
            setTimeout(() => this.scrollToBottom(), 50); 
          } else { 
            this.newMessagesCount++; 
          }
          // Watch for visibility of newly arrived message
          if (this.isChatVisible) this.waitForVisibility(data.id);
        }
        this.cdr.detectChanges();
      });
    });

    this.channel.bind('message-seen', (data: any) => { 
      this.ngZone.run(() => { 
        this.seenMessages.add(data.id); 
        this.cdr.detectChanges(); 
      }); 
    });

    this.channel.bind('client-user-joined', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // ACTIVE`;
          this.channel.trigger('client-presence-ping', { user: this.userName });
          this.cdr.detectChanges();
        }
      });
    });

    this.channel.bind('client-presence-ping', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          this.channel.trigger('client-presence-ack', { user: this.userName });
          this.cdr.detectChanges();
        }
      });
    });

    this.channel.bind('client-presence-ack', (data: any) => {
      this.ngZone.run(() => { 
        if (data.user !== this.userName) { 
          this.partnerOnline = true; 
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`; 
          this.cdr.detectChanges(); 
        } 
      });
    });

    this.channel.bind('client-typing', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.isPartnerTyping = data.isTyping;
          if (data.isTyping && this.isUserAtBottom) { setTimeout(() => this.scrollToBottom(), 50); }
          this.cdr.detectChanges();
        }
      });
    });

    this.channel.bind('client-user-left', (data: any) => {
      this.ngZone.run(() => { 
        if (data.user !== this.userName) { 
          this.partnerOnline = false; 
          this.partnerStatusText = 'PARTNER INACTIVE'; 
          this.cdr.detectChanges(); 
        } 
      });
    });

    this.channel.bind('pusher:subscription_succeeded', () => { this.notifyPresence(true); });
  }

  // --- UPDATED VISIBILITY LOGIC ---
  waitForVisibility(messageId: string) {
    setTimeout(() => {
      const msgElement = document.getElementById(messageId);
      if (!msgElement || this.seenMessages.has(messageId)) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // If message is 50% visible and user is focused on the tab
          if (entry.isIntersecting && document.hasFocus()) {
            this.markAsSeen(messageId);
            observer.disconnect();
          }
        });
      }, { threshold: 0.5 });

      observer.observe(msgElement);
    }, 500); 
  }

  markAsSeen(messageId: string) {
    fetch('/api/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, viewer: this.userName, target: this.targetUser })
    });
  }

  handleTermination() {
    this.sessionTerminated = true;
    this.isChatVisible = false;
    this.userName = '';
    this.messages = [];
    if (this.channel) {
      this.pusher.unsubscribe(this.channel.name);
    }
    this.cdr.detectChanges();
  }

  async terminateOtherSessions(roomID: string) { 
    await fetch('/api/terminate', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userName: this.userName, sessionId: this.currentSessionId, roomID }) 
    }); 
  }

  onScroll() {
    const element = this.myScrollContainer.nativeElement;
    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 60;
    if (atBottom) { 
      this.isUserAtBottom = true; 
      this.newMessagesCount = 0; 
    } else { 
      this.isUserAtBottom = false; 
    }
  }

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      this.newMessagesCount = 0;
      this.isUserAtBottom = true;
      this.cdr.detectChanges();
    } catch (err) { }
  }

  collapseChat() { 
    this.isChatVisible = false; 
    this.notifyPresence(false); 
  }
  
  notifyPresence(isActive: boolean) { 
    if (this.channel) { 
      this.channel.trigger(isActive ? 'client-user-joined' : 'client-user-left', { user: this.userName }); 
    } 
  }
  
  async loadHistory() {
    try {
      const res = await fetch(`/api/history?userA=${this.userName}&userB=${this.targetUser}`);
      const data = await res.json();
      this.ngZone.run(() => {
        this.messages = (Array.isArray(data) ? data : []).sort((a, b) => a.timestamp - b.timestamp);
        this.cdr.detectChanges();
        
        // Mark existing messages for visibility tracking
        setTimeout(() => {
          this.scrollToBottom();
          this.messages.forEach(msg => {
            if (msg.user !== this.userName) {
              this.waitForVisibility(msg.id);
            }
          });
        }, 300);
      });
    } catch (e) { console.error(e); }
  }

  async send() {
    if (!this.newMessage.trim()) return;
    const msg = { 
      id: `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
      user: this.userName, 
      target: this.targetUser, 
      text: this.newMessage, 
      timestamp: Date.now() 
    };
    this.messages.push(msg);
    const text = this.newMessage;
    this.newMessage = '';
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 50);
    await fetch('/api/chat', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ ...msg, text }) 
    });
  }

  onTyping() {
    if (this.channel) this.channel.trigger('client-typing', { user: this.userName, isTyping: true });
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => { 
      if (this.channel) this.channel.trigger('client-typing', { user: this.userName, isTyping: false }); 
    }, 2000);
  }

  trackByFn(index: number, item: any) { return item.id; }
}