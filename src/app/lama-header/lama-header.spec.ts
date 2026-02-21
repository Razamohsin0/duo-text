import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LamaHeader } from './lama-header';

describe('LamaHeader', () => {
  let component: LamaHeader;
  let fixture: ComponentFixture<LamaHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LamaHeader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LamaHeader);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
