export interface HouseholdInfo {
  id: string;
  nazwa: string;
  created_at: string;
  is_owner: boolean;
}

export interface HouseholdMember {
  user_id: string;
  email: string | null;
  rola: "owner" | "admin" | "member";
  created_at: string;
  is_self?: boolean;
}

export interface HouseholdInvitation {
  id: string;
  email: string;
  token: string;
  rola: "admin" | "member";
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  invited_at: string;
  expires_at: string;
}

export interface HouseholdPetSummary {
  id: string;
  imie: string;
  gatunek: "cat" | "dog";
  rasa?: string | null;
  avatar_path?: string | null;
}

export interface AvailableHouseholdItem {
  id: string;
  nazwa: string;
  rola: "owner" | "admin" | "member";
  is_active: boolean;
}

export interface HouseholdDetailsResponse {
  household: HouseholdInfo;
  owner: HouseholdMember;
  members: HouseholdMember[];
  invitations: HouseholdInvitation[];
  pets: HouseholdPetSummary[];
  availableHouseholds?: AvailableHouseholdItem[];
}

export interface InvitationDetailsResponse {
  invitation: {
    id: string;
    email: string;
    status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
    expires_at: string;
    created_at: string;
  };
  household: {
    id: string;
    nazwa: string;
  } | null;
  inviter: {
    email: string;
  };
  pets: {
    id: string;
    imie: string;
    gatunek: "cat" | "dog";
  }[];
}
