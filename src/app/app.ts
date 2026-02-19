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
  
  // FIX: This solves the TS2551 error
  seenMessages: Set<string> = new Set(); 
  
  private pusher: any;
  private channel: any;

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true,
      enabledTransports: ['ws', 'wss'] 
    });

    this.channel = this.pusher.subscribe('chat-room');
    
    // 1. Listen for new messages
    this.channel.bind('new-message', (data: any) => {
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.messages.push(data);
          // 2. Automatically tell the sender we saw it
          this.markAsSeen(data.id);
        }
        this.cdr.detectChanges();
      });
    });

    // 3. Listen for "Seen" receipts from others
    this.channel.bind('message-seen', (data: any) => {
      this.ngZone.run(() => {
        this.seenMessages.add(data.id);
        this.cdr.detectChanges();
      });
    });
  }

  ngAfterViewChecked() {        
    this.scrollToBottom();        
  } 

  scrollToBottom(): void {
    try {
      this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
    } catch(err) { }                 
  }

  setUserName() {
    if (this.nameInput.trim()) {
      this.userName = this.nameInput;
      this.cdr.detectChanges();
    }
  }

  markAsSeen(messageId: string) {
    if (!messageId) return;
    fetch('/api/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, viewer: this.userName })
    }).catch(err => console.error("Seen error:", err));
  }

  async send() {
    if (this.newMessage.trim()) {
      const messageId = `msg-${Date.now()}`;
      const msg = { id: messageId, user: this.userName, text: this.newMessage };

      // Optimistic update
      this.messages.push(msg); 
      this.newMessage = ''; 
      this.cdr.detectChanges(); 

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
    }
  }
}