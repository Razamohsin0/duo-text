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

  // Identity & Connection State
  userName = '';
  targetUser = ''; 
  nameInput = '';
  connectionStatus: string | null = null;
  
  // UI & Visibility State
  isChatVisible = false; // Controls collapse/expand without logout
  partnerOnline = false;
  partnerStatusText = 'WAITING FOR ENCRYPTED LINK...';
  
  // Messaging Data
  newMessage = '';
  messages: any[] = [];
  seenMessages: Set<string> = new Set(); 
  
  // Interaction State
  isPartnerTyping = false;
  typingTimeout: any;
  
  // Security & Persistence
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

    // Ensure partner is notified if the tab is closed
    window.addEventListener('beforeunload', () => this.collapseChat());
  }

  /**
   * Handles user login and chat expansion.
   * Forces a history re-load and presence notification on every expansion.
   */
  setUserName() {
    if (this.nameInput.trim()) {
      const input = this.nameInput.trim().toLowerCase();
      
      if (this.userName === input) {
        this.isChatVisible = true;
        this.notifyPresence(true); 
        this.loadHistory(); 
        return;
      }

      this.userName = input;
      this.isChatVisible = true;
      
      let roomID = (this.userName === 'user1' || this.userName === 'user2') 
        ? 'private-vault-user1-user2' 
        : 'private-public-plaza';

      this.targetUser = (this.userName === 'user1') ? 'user2' : (this.userName === 'user2' ? 'user1' : 'public_group');

      this.channel = this.pusher.subscribe(roomID);
      this.setupBindings();
      this.loadHistory();
      this.terminateOtherSessions(roomID);
      this.cdr.detectChanges();
    }
  }

  /**
   * Minimizes the chat portal and notifies the partner of inactivity.
   */
  collapseChat() {
    this.isChatVisible = false;
    this.notifyPresence(false); 
  }

  /**
   * Triggers client events to sync presence across both users.
   */
  notifyPresence(isActive: boolean) {
    if (this.channel) {
      this.channel.trigger(isActive ? 'client-user-joined' : 'client-user-left', { user: this.userName });
    }
  }

  setupBindings() {
    // 1. Message Handling & Sorting
    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName && !this.messages.find(m => m.id === data.id)) {
          this.messages.push(data);
          this.messages.sort((a, b) => a.timestamp - b.timestamp);
          if (this.isChatVisible) this.waitForVisibility(data.id);
        }
        this.cdr.detectChanges();
      });
    });

    // 2. Receipt Sync
    this.channel.bind('message-seen', (data: any) => {
      this.ngZone.run(() => {
        this.seenMessages.add(data.id);
        this.cdr.detectChanges();
      });
    });

    // 3. Bidirectional Handshake: User Joined (Ping)
    this.channel.bind('client-user-joined', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          
          // User A sees User B joined, so User A pings back to confirm their own presence
          this.channel.trigger('client-presence-ping', { user: this.userName });
          
          this.syncOnArrival(); 
          this.cdr.detectChanges();
        }
      });
    });

    // 4. Bidirectional Handshake: Presence Ping (Pong/Ack)
    this.channel.bind('client-presence-ping', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          
          // User B replies to User A's ping with an Acknowledgment
          this.channel.trigger('client-presence-ack', { user: this.userName });
          
          this.syncOnArrival();
          this.cdr.detectChanges();
        }
      });
    });

    // 5. Bidirectional Handshake: Presence Acknowledgment
    this.channel.bind('client-presence-ack', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          this.cdr.detectChanges();
        }
      });
    });

    // 6. Partner Inactivity Handler
    this.channel.bind('client-user-left', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = false;
          this.partnerStatusText = 'PARTNER INACTIVE';
          this.cdr.detectChanges();
        }
      });
    });

    // 7. Typing Indicators
    this.channel.bind('client-typing', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.isPartnerTyping = data.isTyping;
          this.cdr.detectChanges();
        }
      });
    });

    // Notify presence once subscription is fully established
    this.channel.bind('pusher:subscription_succeeded', () => {
      this.notifyPresence(true);
    });
  }

  /**
   * Forces the "Seen" status for unread messages received while offline.
   */
  syncOnArrival() {
    const partnerMsgs = this.messages.filter(m => m.user !== this.userName);
    if (partnerMsgs.length > 0) {
      this.markAsSeen(partnerMsgs[partnerMsgs.length - 1].id);
    }
  }

  /**
   * Uses Intersection Observer to detect when a user scrolls to a new message.
   */
  waitForVisibility(messageId: string) {
    setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && document.hasFocus()) {
            this.markAsSeen(messageId);
            observer.disconnect();
          }
        });
      }, { threshold: 0.5 });
      const lastMsg = document.querySelector('.message-item.other:last-child');
      if (lastMsg) observer.observe(lastMsg);
    }, 200);
  }

  markAsSeen(messageId: string) {
    fetch('/api/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, viewer: this.userName, target: this.targetUser })
    });
  }

  async loadHistory() {
    try {
      const res = await fetch(`/api/history?userA=${this.userName}&userB=${this.targetUser}`);
      const data = await res.json();
      this.ngZone.run(() => {
        let history = Array.isArray(data) ? data : [];
        // Ensure strictly chronological order
        this.messages = history.sort((a, b) => a.timestamp - b.timestamp);
        
        this.syncOnArrival(); 
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 200);
      });
    } catch (e) { console.error("Vault history error:", e); }
  }

  async send() {
    if (!this.newMessage.trim()) return;
    const msgId = `id-${Date.now()}`;
    const msg = { 
      id: msgId, 
      user: this.userName, 
      target: this.targetUser, 
      text: this.newMessage, 
      timestamp: Date.now() 
    };
    
    this.messages.push(msg);
    const textToSend = this.newMessage;
    this.newMessage = '';
    this.cdr.detectChanges();

    await fetch('/api/chat', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ ...msg, text: textToSend }) 
    });
  }

  onTyping() {
    if (this.channel) this.channel.trigger('client-typing', { user: this.userName, isTyping: true });
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      if (this.channel) this.channel.trigger('client-typing', { user: this.userName, isTyping: false });
    }, 2000);
  }

  async terminateOtherSessions(roomID: string) {
    await fetch('/api/terminate', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userName: this.userName, sessionId: this.currentSessionId, roomID }) 
    });
  }

  ngAfterViewChecked() { this.scrollToBottom(); }
  
  scrollToBottom(): void {
    try { 
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight; 
    } catch (err) { }
  }
  
  trackByFn(index: number, item: any) {
    return item.id;
  }
}