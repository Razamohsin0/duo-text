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
  newMessage = '';
  messages: any[] = [];
  seenMessages: Set<string> = new Set(); 
  
  private pusher: any;
  private channel: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    // Initialize Pusher Client
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true
    });
  }

  /**
   * INITIATE PROTOCOL
   * Sets the identity and creates a private vault key
   */
  setUserName() {
    if (this.nameInput.trim()) {
      const input = this.nameInput.trim().toLowerCase();
      
      // PRIVACY LOCK: Only user1 and user2 share a vault.
      // If someone enters another name, they get their own isolated empty vault.
      this.userName = input;
      if (this.userName === 'user1') {
        this.targetUser = 'user2';
      } else if (this.userName === 'user2') {
        this.targetUser = 'user1';
      } else {
        this.targetUser = 'system'; // Isolated chat for others
      }

      // Join a unique private room based on both names (alphabetical order)
      const roomID = [this.userName, this.targetUser].sort().join('-');
      this.channel = this.pusher.subscribe(`room-${roomID}`);
      
      this.setupBindings();
      this.loadHistory();
      this.cdr.detectChanges();
    }
  }

  setupBindings() {
    // Listen for new messages in the private vault
    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        const exists = this.messages.find(m => m.id === data.id);
        if (data.user !== this.userName && !exists) {
          this.messages.push(data);
          this.waitForVisibility(data.id);
        }
        this.cdr.detectChanges();
      });
    });

    // Listen for 'Seen' receipts
    this.channel.bind('message-seen', (data: any) => {
      this.ngZone.run(() => {
        this.seenMessages.add(data.id);
        this.cdr.detectChanges();
      });
    });
  }

  /**
   * UPLINK HISTORY
   * Pulls messages only belonging to this specific user pair
   */
  async loadHistory() {
    try {
      const res = await fetch(`/api/history?userA=${this.userName}&userB=${this.targetUser}`);
      const data = await res.json();
      this.ngZone.run(() => {
        this.messages = data;
        this.cdr.detectChanges();
        
        // Mark the last incoming message as seen upon loading
        if (this.messages.length > 0) {
          const lastMsg = this.messages[this.messages.length - 1];
          if (lastMsg.user !== this.userName) {
            this.markAsSeen(lastMsg.id);
          }
        }
        
        setTimeout(() => this.scrollToBottom(), 100);
      });
    } catch (e) {
      console.error("Historical Uplink Failed", e);
    }
  }

  /**
   * PRECISION SYNC
   * Uses IntersectionObserver to detect when the user actually sees a message
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
      }, { threshold: 0.8 });

      const elements = document.querySelectorAll('.message-item.other');
      const lastElement = elements[elements.length - 1];
      if (lastElement) observer.observe(lastElement);
    }, 100);
  }

  ngAfterViewChecked() { this.scrollToBottom(); } 

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch(err) { }                 
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

  async send() {
    if (!this.newMessage.trim()) return;
    
    const messageId = `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const msg = { 
      id: messageId, 
      user: this.userName, 
      target: this.targetUser,
      text: this.newMessage 
    };

    // Optimistic UI Update
    this.messages.push(msg); 
    const currentText = this.newMessage;
    this.newMessage = ''; 
    this.cdr.detectChanges(); 

    // POST to Locked API
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: messageId, 
        user: this.userName, 
        target: this.targetUser, 
        text: currentText 
      })
    });
  }
}