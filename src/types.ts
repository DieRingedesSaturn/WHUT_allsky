export interface Source {
  name: string;
  ra: number;
  dec: number;
  type: string;
  vmag: number;
}

export interface ObserverLocation {
  lat: number;
  lon: number;
  alt: number;
}

export interface AltitudeSample {
  time: Date;
  targetAlt: number;
  moonAlt: number | null;
  moonAngle: number | null;
}

export interface StandardStarCandidate {
  name: string;
  ra: number;
  dec: number;
  type: string;
  vmag: number;
  separationArcmin: number;
  altitudeDeg: number;
  observable: boolean;
  targetAltitudeDeg: number;
}

export type DisplayMode = "deg" | "hms";

