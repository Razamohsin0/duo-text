import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. Use ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Pusher from 'pusher-js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html' 
})
export class AppComponent implements OnInit {
  userName = '';
  nameInput = '';
  newMessage = '';
  messages: any[] = [];
  private pusher: any;
  private channel: any;

  // 2. Inject ChangeDetectorRef
  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true,
      enabledTransports: ['ws', 'wss'] 
    });

    this.channel = this.pusher.subscribe('chat-room');
    
    this.channel.bind('new-message', (data: any) => {
      if (data.user !== this.userName) {
        this.messages.push(data);
        
        // 3. MANUALLY FORCE REFRESH
        // This makes the message appear WITHOUT needing to type or click
        this.cdr.detectChanges(); 
      }
    });
  }

  setUserName() {
    if (this.nameInput.trim()) {
      this.userName = this.nameInput;
      this.cdr.detectChanges();
    }
  }

  send() {
    if (this.newMessage.trim()) {
      const msg = { user: this.userName, text: this.newMessage };
      this.messages.push(msg); 
      this.newMessage = ''; 
      
      // Force refresh for the sender's optimistic update
      this.cdr.detectChanges(); 

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
    }
  }
}