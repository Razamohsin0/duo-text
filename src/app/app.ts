import { Component, OnInit, ChangeDetectorRef, NgZone, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Pusher from 'pusher-js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html'
})
export class AppComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  // Identity & Connection
  userName = '';
  targetUser = ''; 
  nameInput = '';
  connectionStatus: string | null = null;
  
  // Partner Presence Logic
  partnerOnline = false;
  partnerStatusText = 'WAITING FOR ENCRYPTED LINK...';
  
  // Messaging
  newMessage = '';
  messages: any[] = [];
  seenMessages: Set<string> = new Set(); 
  
  // State Indicators
  isPartnerTyping = false;
  typingTimeout: any;
  
  // Security & Sync
  sessionTerminated = false;
  currentSessionId = Math.random().toString(36).substring(7);
  
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
      this.userName = input;
      
      let roomID = '';
      let mode = '';

      if (this.userName === 'user1' || this.userName === 'user2') {
        this.targetUser = (this.userName === 'user1') ? 'user2' : 'user1';
        roomID = 'private-vault-user1-user2';
        mode = 'SECURE VAULT';
      } else {
        this.targetUser = 'public_group';
        roomID = 'private-public-plaza';
        mode = 'PUBLIC PLAZA';
      }

      this.channel = this.pusher.subscribe(roomID);
      this.connectionStatus = `UPLINK ESTABLISHED // MODE: ${mode}`;
      
      setTimeout(() => { 
        this.connectionStatus = null; 
        this.cdr.detectChanges(); 
      }, 4000);

      this.setupBindings();
      this.loadHistory();
      this.terminateOtherSessions(roomID);

      this.cdr.detectChanges();
    }
  }

  setupBindings() {
    // 1. Message Handling
    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName && !this.messages.find(m => m.id === data.id)) {
          this.messages.push(data);
          this.waitForVisibility(data.id);
        }
        this.cdr.detectChanges();
      });
    });

    // 2. Seen Status
    this.channel.bind('message-seen', (data: any) => {
      this.ngZone.run(() => {
        this.seenMessages.add(data.id);
        this.cdr.detectChanges();
      });
    });

    // 3. Typing Indicator
    this.channel.bind('client-typing', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.isPartnerTyping = data.isTyping;
          this.cdr.detectChanges();
        }
      });
    });

    // 4. Session Kill-Switch
    this.channel.bind('terminate-session', (data: any) => {
      this.ngZone.run(() => {
        if (data.userName === this.userName && data.sessionId !== this.currentSessionId) {
          this.sessionTerminated = true;
          this.pusher.unsubscribe(this.channel.name);
          this.cdr.detectChanges();
        }
      });
    });

    // --- HANDSHAKE & PRESENCE PROTOCOL ---

    // 5. User A hears User B join via Backend
    this.channel.bind('user-joined', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} HAS JOINED`;
          
          // Wait 1.5s for User B's connection to stabilize, then Ping
          setTimeout(() => {
            this.channel.trigger('client-presence-ping', { user: this.userName });
            this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
            this.cdr.detectChanges();
          }, 1500);
        }
      });
    });

    // 6. User B receives Ping from User A
    this.channel.bind('client-presence-ping', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          
          // Send back ACK so User A knows sync is complete
          this.channel.trigger('client-presence-ack', { user: this.userName });
          this.cdr.detectChanges();
        }
      });
    });

    // 7. User A receives ACK (Final Sync)
    this.channel.bind('client-presence-ack', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          this.cdr.detectChanges();
        }
      });
    });

    // 8. Listen for Partner Disconnect (Manual Trigger)
    this.channel.bind('client-user-left', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = false;
          this.partnerStatusText = `${data.user.toUpperCase()} DISCONNECTED`;
          this.cdr.detectChanges();
        }
      });
    });

    // 9. Tab Closure Detection
    window.addEventListener('beforeunload', () => {
      if (this.channel) {
        this.channel.trigger('client-user-left', { user: this.userName });
      }
    });
  }

  onTyping() {
    this.channel.trigger('client-typing', { user: this.userName, isTyping: true });
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.channel.trigger('client-typing', { user: this.userName, isTyping: false });
    }, 2000);
  }

  async loadHistory() {
    try {
      const res = await fetch(`/api/history?userA=${this.userName}&userB=${this.targetUser}`);
      const data = await res.json();
      this.ngZone.run(() => {
        this.messages = Array.isArray(data) ? data.reverse() : [];
        this.cdr.detectChanges();
        if (this.messages.length > 0) {
          const lastMsg = this.messages[this.messages.length - 1];
          if (lastMsg.user !== this.userName) this.markAsSeen(lastMsg.id);
        }
        setTimeout(() => this.scrollToBottom(), 100);
      });
    } catch (e) { console.error("Database Error", e); }
  }

  async send() {
    if (!this.newMessage.trim()) return;
    const messageId = `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const msg = { 
      id: messageId, 
      user: this.userName, 
      target: this.targetUser, 
      text: this.newMessage,
      timestamp: Date.now()
    };
    this.messages.push(msg);
    const textToSend = this.newMessage;
    this.newMessage = '';
    this.channel.trigger('client-typing', { user: this.userName, isTyping: false });
    this.cdr.detectChanges();

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...msg, text: textToSend })
    });
  }

  waitForVisibility(messageId: string) {
    setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && document.hasFocus()) {
            this.markAsSeen(messageId);
            observer.disconnect();
          }
        });
      }, { threshold: 0.8 });
      const elements = document.querySelectorAll('.message-item.other');
      const lastElement = elements[elements.length - 1];
      if (lastElement) observer.observe(lastElement);
    }, 100);
  }

  markAsSeen(messageId: string) {
    fetch('/api/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, viewer: this.userName, target: this.targetUser })
    });
  }

  async terminateOtherSessions(roomID: string) {
    await fetch('/api/terminate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userName: this.userName, 
        sessionId: this.currentSessionId, 
        roomID: roomID 
      })
    });
  }

  ngAfterViewChecked() { this.scrollToBottom(); }
  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }
}