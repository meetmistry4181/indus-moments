export type UserRole = 'pending' | 'student' | 'faculty' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  enrollment_number: string;
  semester: number | null;
  year: number | null;
  designation: string;
  avatar_url: string;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  club_role: 'president' | 'member';
  created_at: string;
}

export interface ClubEvent {
  id: string;
  club_id: string | null;
  title: string;
  description: string;
  event_date: string;
  venue: string;
  category: string;
  photographer: string;
  created_by: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  event_id: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  photo_id: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  photo_id: string | null;
  event_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface MatchResult {
  photo_id: string;
  distance: number;
}

export const EVENT_CATEGORIES = [
  'Hackathon',
  'Sports Day',
  'Orientation',
  'Annual Function',
  'Seminar',
  'Workshop',
  'Industrial Visit',
  'Placement Drive',
  'Cultural Night',
  'Technical Fest',
  'Convocation',
  'Farewell',
  'General',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
