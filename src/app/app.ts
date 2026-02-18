import { Component, OnInit, NgZone } from '@angular/core'; // Added NgZone
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

  // We inject NgZone here to force the UI to update
  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.pusher = new Pusher('f67a69ab8d352765a811', { 
      cluster: 'ap2',
      forceTLS: true,
      enabledTransports: ['ws', 'wss'] 
    });

    this.channel = this.pusher.subscribe('chat-room');
    
    this.channel.bind('new-message', (data: any) => {
      // We wrap this in ngZone.run so the message appears 
      // the MOMENT it arrives, without needing a click.
      this.ngZone.run(() => {
        if (data.user !== this.userName) {
          this.messages.push(data);
        }
      });
    });
  }

  setUserName() {
    if (this.nameInput.trim()) this.userName = this.nameInput;
  }

  send() {
    if (this.newMessage.trim()) {
      const msg = { user: this.userName, text: this.newMessage };
      this.messages.push(msg); 
      this.newMessage = ''; 

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      }).catch(err => console.error("Failed to send:", err));
    }
  }
}