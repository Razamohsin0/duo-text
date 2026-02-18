import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Pusher from 'pusher-js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html' // Double check if this is app.html or app.component.html
})
export class AppComponent implements OnInit {
  userName = '';
  nameInput = '';
  newMessage = '';
  messages: any[] = [];
  private pusher: any;
  private channel: any;

  ngOnInit() {
    // Force WebSockets for the fastest possible connection
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true,
      enabledTransports: ['ws', 'wss'] 
    });

    this.channel = this.pusher.subscribe('chat-room');
    
    this.channel.bind('new-message', (data: any) => {
      // FIX: Only add the message if it's from someone else
      // This prevents the "double message" bug
      if (data.user !== this.userName) {
        this.messages.push(data);
      }
    });
  }

  setUserName() {
    if (this.nameInput.trim()) this.userName = this.nameInput;
  }

  async send() {
    if (this.newMessage.trim()) {
      const msg = { user: this.userName, text: this.newMessage };

      // 1. Show it on your screen INSTANTLY
      this.messages.push(msg); 
      
      const messageToSend = this.newMessage;
      this.newMessage = ''; 

      // 2. Send to Vercel/Pusher in the background
      // We don't 'await' this so the UI stays snappy
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      }).catch(err => console.error("Failed to send:", err));
    }
  }
}