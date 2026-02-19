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
          
          // Instead of immediate marking, we observe the element
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

  // ADVANCED: Only marks seen when the message bubble is actually in the viewport
  waitForVisibility(messageId: string) {
    setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // Only fire if the message is visible AND the tab is active
          if (entry.isIntersecting && document.hasFocus()) {
            this.markAsSeen(messageId);
            observer.disconnect(); // Stop watching once seen
          }
        });
      }, { threshold: 0.8 }); // 80% of the bubble must be visible

      // Find the specific message element we just added
      const elements = document.querySelectorAll('.message-item.other');
      const lastElement = elements[elements.length - 1];
      
      if (lastElement) {
        observer.observe(lastElement);
      }
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

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, user: this.userName, text: currentText })
    });
  }
}