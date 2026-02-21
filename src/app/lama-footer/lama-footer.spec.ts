import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LamaFooter } from './lama-footer';

describe('LamaFooter', () => {
  let component: LamaFooter;
  let fixture: ComponentFixture<LamaFooter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LamaFooter]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LamaFooter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
