
export interface WatermarkedPhoto {
  id: string;
  doorId: string;
  aircraftType: string; // Added to distinguish between A319/A320/A321
  src: string; // High-res image (Lazy loaded or empty in main list)
  thumbnail?: string; // Low-res image for UI listing
  timestamp: string;
}

export interface AircraftDoor {
  id: string;
  label: string;
  watermark: string;
  x: number; // Percentage from left
  y: number; // Percentage from top
}

export interface AircraftConfig {
  id: string;
  label: string;
  doors: AircraftDoor[];
  fuselagePath: string; // SVG path d attribute
  tailY: number; // Vertical offset for tail stabilizers
  wingY?: number; // Vertical offset for wings
  iconUrl?: string; // URL for the aircraft icon
}

export interface WatermarkConfig {
  text?: string;
  showTimestamp: boolean;
}

// Keeping these for compatibility if needed, though mostly replaced by specific aircraft logic
export interface Photo {
  id: string;
  watermarkedSrc: string;
}

export interface PhotoSubSlot {
  id: string;
  name?: string;
  photos: Photo[];
}

export interface PhotoSlot {
  id: string;
  name: string;
  description?: string;
  subSlots: PhotoSubSlot[];
}

export interface ProjectTemplate {
  id: string;
  title: string;
  category: string;
  icon: string;
}
