import { Component, OnInit } from '@angular/core';
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

  ngOnInit() {
    // Connect to Pusher
    this.pusher = new Pusher('f67a69ab8d352765a811', { cluster: 'ap2' });
    this.channel = this.pusher.subscribe('chat-room');
    
    // Listen for new messages
    this.channel.bind('new-message', (data: any) => {
      this.messages.push(data);
    });
  }

  setUserName() {
    if (this.nameInput.trim()) this.userName = this.nameInput;
  }

  async send() {
    if (this.newMessage.trim()) {
      const msg = { user: this.userName, text: this.newMessage };
      
      // Send to Vercel API
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });

      this.newMessage = '';
    }
  }
}