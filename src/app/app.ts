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
  
  newMessage = '';
  messages: any[] = [];
  seenMessages: Set<string> = new Set(); 
  
  sessionTerminated = false;
  currentSessionId = Math.random().toString(36).substring(7);
  
  private pusher: any;
  private channel: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true
    });
  }

  setUserName() {
    if (this.nameInput.trim()) {
      const input = this.nameInput.trim().toLowerCase();
      this.userName = input;
      
      let roomID = '';
      let mode = '';

      // ELITE PAIR LOCK
      if (this.userName === 'user1' || this.userName === 'user2') {
        this.targetUser = (this.userName === 'user1') ? 'user2' : 'user1';
        roomID = 'vault-user1-user2';
        mode = 'SECURE VAULT';
      } 
      // PUBLIC PLAZA
      else {
        this.targetUser = 'public_group';
        roomID = 'public-plaza';
        mode = 'PUBLIC PLAZA';
      }

      // Explicitly subscribe to the same channel name the API uses
      this.channel = this.pusher.subscribe(`room-${roomID}`);
      
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
    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName && !this.messages.find(m => m.id === data.id)) {
          this.messages.push(data);
          this.waitForVisibility(data.id);
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

    this.channel.bind('terminate-session', (data: any) => {
      this.ngZone.run(() => {
        if (data.userName === this.userName && data.sessionId !== this.currentSessionId) {
          this.sessionTerminated = true;
          this.cdr.detectChanges();
        }
      });
    });
  }

  async loadHistory() {
    // History is only fetched for user1/user2 via the API's internal logic
    try {
      const res = await fetch(`/api/history?userA=${this.userName}&userB=${this.targetUser}`);
      const data = await res.json();
      this.ngZone.run(() => {
        this.messages = data;
        this.cdr.detectChanges();
        if (this.messages.length > 0) {
          const lastMsg = this.messages[this.messages.length - 1];
          if (lastMsg.user !== this.userName) this.markAsSeen(lastMsg.id);
        }
        setTimeout(() => this.scrollToBottom(), 100);
      });
    } catch (e) { console.error("History Error", e); }
  }

  async send() {
    if (!this.newMessage.trim()) return;
    
    const messageId = `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const msg = { 
      id: messageId, 
      user: this.userName, 
      target: this.targetUser, 
      text: this.newMessage 
    };

    this.messages.push(msg);
    const textToSend = this.newMessage;
    this.newMessage = '';
    this.cdr.detectChanges();

    // The API handles whether to save to Redis or just broadcast
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
      body: JSON.stringify({ 
        id: messageId, 
        viewer: this.userName, 
        target: this.targetUser 
      })
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