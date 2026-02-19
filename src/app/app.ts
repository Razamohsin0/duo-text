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
  nameInput = '';
  newMessage = '';
  messages: any[] = [];
  seenMessages: Set<string> = new Set(); 
  
  private pusher: any;
  private channel: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true
    });

    this.channel = this.pusher.subscribe('chat-room');
    
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

    this.channel.bind('message-seen', (data: any) => {
      this.ngZone.run(() => {
        this.seenMessages.add(data.id);
        this.cdr.detectChanges();
      });
    });
  }

  // Pulls last 50 messages from Mumbai Redis
  async loadHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      this.ngZone.run(() => {
        this.messages = data;
        this.cdr.detectChanges();
        
        // After history loads, mark the very last message as seen
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

  setUserName() {
    if (this.nameInput.trim()) {
      this.userName = this.nameInput;
      this.loadHistory(); // Load stored messages immediately on login
      this.cdr.detectChanges();
    }
  }

  markAsSeen(messageId: string) {
    fetch('/api/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, viewer: this.userName })
    });
  }

  async send() {
    if (!this.newMessage.trim()) return;
    
    const messageId = `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const msg = { id: messageId, user: this.userName, text: this.newMessage };

    this.messages.push(msg); 
    const currentText = this.newMessage;
    this.newMessage = ''; 
    this.cdr.detectChanges(); 

    // This hits api/chat.js which now saves to Redis before broadcasting
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, user: this.userName, text: currentText })
    });
  }
}