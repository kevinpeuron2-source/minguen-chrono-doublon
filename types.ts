
export enum RaceStatus {
  READY = 'READY',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED'
}

export enum ParticipantStatus {
  REGISTERED = 'REGISTERED',
  STARTED = 'STARTED',
  FINISHED = 'FINISHED',
  DNF = 'DNF'
}

export enum RaceType {
  GROUP = 'GROUP',
  TIME_TRIAL = 'TIME_TRIAL'
}

export interface Checkpoint {
  id: string;
  name: string;
  distance: number; // in km
  isMandatory: boolean;
}

export interface GlobalCombinedPost {
  id: string;
  name: string;
  assignments: {
    raceId: string;
    raceName: string;
    checkpointId: string;
    checkpointName: string;
  }[];
}

export interface Participant {
  id: string;
  bib: string;
  firstName: string;
  lastName: string;
  gender: string;
  category: string;
  club?: string;
  raceId: string;
  status: ParticipantStatus;
  startTime?: number;
}

export interface Passage {
  id: string;
  participantId: string;
  bib: string;
  checkpointId: string;
  checkpointName: string;
  timestamp: number;
  netTime: number;
  rank?: number;
}

export interface Race {
  id: string;
  name: string;
  distance: number;
  type: RaceType;
  status: RaceStatus;
  startTime?: number;
  checkpoints: Checkpoint[];
  segments?: string[]; // Disciplines entre les points (ex: ["Trail", "VTT"])
}

export interface MarshalPresence {
  id: string;
  name: string;
  stationName: string;
  checkpointId: string;
  raceId: string;
  lastActive: number;
}
