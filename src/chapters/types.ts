import type { RoomId } from '../data';

export interface QuestView {
  title: string;
  sub: string;
  slots: number;
  /** Filled slot contents (letters, or emoji for items). */
  letters: string[];
}

/** One room's story. The Game routes clicks in that room here first. */
export interface Chapter {
  readonly room: RoomId;
  /** Restore visuals from the save (called once on load). */
  apply(): void;
  quest(): QuestView;
  hints(): string[];
  /** Return true if the click was handled (the generic reaction is then skipped). */
  onClick(id: string): boolean;
  onEnter?(): void;
  update?(dt: number, t: number): void;
  /** Called when the Shadow catches you here — take away one piece of progress. */
  loseOne?(): string | null;
}
