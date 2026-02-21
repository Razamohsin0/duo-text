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

  userName = '';
  targetUser = ''; 
  nameInput = '';
  connectionStatus: string | null = null;
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
  
  private pusher: any;
  private channel: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true,
      authEndpoint: '/api/pusher/auth'
    });

    // Global listener for tab closure to notify partner instantly
    window.addEventListener('beforeunload', () => this.collapseChat());
  }

  setUserName() {
    if (this.nameInput.trim()) {
      const input = this.nameInput.trim().toLowerCase();
      if (this.userName === input) {
        this.isChatVisible = true;
        this.notifyStatus(true); // Tell partner we are back
        this.cdr.detectChanges();
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

  // New Method: Handles manual collapse and notifies partner
  collapseChat() {
    this.isChatVisible = false;
    this.notifyStatus(false);
  }

  notifyStatus(active: boolean) {
    if (this.channel) {
      const event = active ? 'client-user-joined' : 'client-user-left';
      this.channel.trigger(event, { user: this.userName });
    }
  }

  setupBindings() {
    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.messages.push(data);
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

    // Logic to handle partner joining OR expanding their chat
    this.channel.bind('client-user-joined', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = true;
          this.partnerStatusText = `${data.user.toUpperCase()} // LINK ACTIVE`;
          this.syncSeenOnArrival(); // Force Sync
          this.cdr.detectChanges();
        }
      });
    });

    // Logic to handle partner closing OR collapsing their chat
    this.channel.bind('client-user-left', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.partnerOnline = false;
          this.partnerStatusText = 'PARTNER INACTIVE';
          this.cdr.detectChanges();
        }
      });
    });

    this.channel.bind('client-typing', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.isPartnerTyping = data.isTyping;
          this.cdr.detectChanges();
        }
      });
    });
  }

  // CRITICAL FIX: Marks all unread partner messages as seen when they appear
  syncSeenOnArrival() {
    const unreadPartnerMsgs = this.messages.filter(m => m.user !== this.userName);
    unreadPartnerMsgs.forEach(msg => this.markAsSeen(msg.id));
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
      }, { threshold: 0.5 });
      const els = document.querySelectorAll('.message-item.other');
      if (els.length > 0) observer.observe(els[els.length - 1]);
    }, 200);
  }

  markAsSeen(messageId: string) {
    fetch('/api/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, viewer: this.userName, target: this.targetUser })
    });
  }

  async send() {
    if (!this.newMessage.trim()) return;
    const msg = { 
      id: `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
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

  async loadHistory() {
    try {
      const res = await fetch(`/api/history?userA=${this.userName}&userB=${this.targetUser}`);
      const data = await res.json();
      this.messages = Array.isArray(data) ? data.reverse() : [];
      this.syncSeenOnArrival(); // Sync seen status on load
      this.cdr.detectChanges();
      this.scrollToBottom();
    } catch (e) { console.error(e); }
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
}