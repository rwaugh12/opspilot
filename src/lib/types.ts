// Shared types used by the API route and the dashboard UI.

export type Category =
  | "Equipment"
  | "Customer Complaint"
  | "Staffing"
  | "Inventory"
  | "Facilities"
  | "IT"
  | "Other";

export type Priority = "Urgent" | "High" | "Normal" | "Low";

export type Team =
  | "Maintenance"
  | "Guest Services"
  | "HR / Scheduling"
  | "Supply Chain"
  | "Facilities"
  | "IT Help Desk"
  | "Store Manager";

// What the AI (or demo engine) returns for one request.
export interface TriageResult {
  category: Category;
  priority: Priority;
  team: Team;
  summary: string; // one-line summary for the dashboard
  location: string | null; // store or site, if mentioned
  suggestedReply: string; // draft reply to the person who submitted
  nextSteps: string[]; // checklist for the team that receives it
}

// A request after it has been triaged and saved to the dashboard.
export interface Ticket extends TriageResult {
  id: string;
  text: string; // original request text
  submittedBy: string;
  createdAt: string; // ISO timestamp
  status: "Open" | "Done";
  engine: "ai" | "demo"; // which engine triaged it
}
