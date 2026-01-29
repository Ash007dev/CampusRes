Epic 1: Core Booking & Scheduling Engine
Goal: Enable seamless, conflict-free searching and reservation.
User Story 1.1: View Availability Calendar
1. User Story 2. Implementation (Tasksets)
"As a Student, I want to view a calendar
grid of room availability, so that I can
visually identify free slots."
• Task 1: Integrate react-big-calendar or
FullCalendar and style it to match campus
branding.
• Task 2: Create GET /api/slots endpoint
that efficiently fetches only "Busy"
metadata for a date range to optimize load
time.
3. Design 4. Testing (AC)
• UI: Weekly Grid View. Green=Free,
Red=Booked, Grey=Closed.
• Interaction: Hover to see "Booked by
[Dept]".
• Given I am on the dashboard,
• When I select "Seminar Hall A",
• Then I should see the weekly schedule
with booked slots in red.
User Story 1.2: Basic Slot Reservation
1. User Story 2. Implementation (Tasksets)
"As a User, I want to book a specific time
slot, so that I can secure the room for my
event."
• Task 1: Implement PostgreSQL EXCLUDE
constraint with tsrange to physically
prevent overlapping time ranges.
• Task 2: Build the booking transaction
logic ensuring atomic insertion of booking
details.
3. Design 4. Testing (AC)
• UI: "Book Now" modal on slot click.
• Form: Title, Description, Attendees
Count.
• Given a slot is free,
• When I confirm booking,
• Then the slot should turn red instantly for
everyone.
User Story 1.3: Advanced Filtering
1. User Story 2. Implementation (Tasksets)
"As a Club Lead, I want to filter rooms by
amenities (Projector, AC), so I find a
suitable venue."
• Task 1: Store amenities as a JSONB
column or relationship table for flexible
querying.
• Task 2: Implement backend filter logic
using SQL WHERE amenities ?&
['projector', 'ac'].
3. Design 4. Testing (AC)
• UI: Sidebar Checkboxes: "Projector",
"Whiteboard", "Mic".
• Result: List updates dynamically.
• Given I need a Projector,
• When I check the "Projector" filter,
• Then rooms without projectors should
disappear.
User Story 1.4: Recurring Bookings
1. User Story 2. Implementation (Tasksets)
"As a Professor, I want to book a room
every Monday for 10 weeks, so I don't
have to book manually."
• Task 1: Write a utility function to generate
an array of dates based on start/end dates
and frequency.
• Task 2: Implement "All-or-Nothing"
transaction logic: if any single future slot is
busy, reject the entire series.
3. Design 4. Testing (AC)
• UI: "Repeat" Dropdown (Daily/Weekly).
• Input: "End Date" picker.
• Given I select "Weekly" for 5 weeks,
• When I submit,
• Then 5 separate booking IDs should be
generated.
User Story 1.5: Booking Cancellation
1. User Story 2. Implementation (Tasksets)
"As a Student, I want to cancel my
booking, so that others can use the room."
• Task 1: Implement "Soft Delete" logic
(update status to cancelled instead of
deleting row).
• Task 2: Create a trigger to auto-refund
any usage quotas associated with the
booking.
3. Design 4. Testing (AC)
• UI: Red "Cancel" button on My Bookings.
• Confirm: Modal "Are you sure?".
• Given I have a future booking,
• When I click cancel,
• Then the slot should become Green
(Free) again.
User Story 1.6: Capacity-Based Search
1. User Story 2. Implementation (Tasksets)
"As a User, I want to search by
headcount (e.g., 50 people), so I don't
book a tiny room."
• Task 1: Create a search query parameter
?min_capacity=50.
• Task 2: Optimize sorting logic to show
the "Best Fit" (smallest valid room) first to
prevent waste.
3. Design 4. Testing (AC)
• UI: Slider "Number of Attendees".
• Feedback: "Too Small" badge on small
rooms.
• Given I have 100 guests,
• When I search,
• Then 30-seater classrooms should be
hidden.
User Story 1.7: Modify Booking Time
1. User Story 2. Implementation (Tasksets)
"As a User, I want to reschedule my
booking, so I can adjust to plan changes."
• Task 1: Validate availability of the new
slot before allowing update.
• Task 2: Implement a restriction check:
AllowUpdate IF CurrentTime < StartTime - 1
hour.
3. Design 4. Testing (AC)
• UI: Drag-and-drop on Calendar
(Desktop).
• Form: "Edit Time" button (Mobile).
• Given I have a slot at 2 PM,
• When I move it to 4 PM (and it's free),
• Then the booking updates successfully.
User Story 1.8: View Room Details
1. User Story 2. Implementation (Tasksets)
"As a User, I want to see photos of the
room, so I know what it looks like."
• Task 1: Integrate AWS S3 or Cloudinary
SDK to fetch image URLs.
• Task 2: Build an image carousel
component with lazy loading for
performance.
3. Design 4. Testing (AC)
• UI: Modal with Gallery + Equipment List.
• Data: "Last Cleaned" timestamp.
• Given I click "Room 101",
• When the details load,
• Then I should see at least 2 photos of the
interior.
User Story 1.9: My Bookings Dashboard
1. User Story 2. Implementation (Tasksets)
"As a User, I want to see all my past and
upcoming bookings, for personal
tracking."
• Task 1: Create GET /my-bookings API
with pagination logic.
• Task 2: Filter results into "Active" vs
"History" arrays in the backend response.
3. Design 4. Testing (AC)
• UI: List View with Status Badges.
• Export: "Add to Google Calendar" button.
• Given I booked 3 slots,
• When I open "My Bookings",
• Then I should see exactly those 3
records.
User Story 1.10: Department Restriction Logic
1. User Story 2. Implementation (Tasksets)
"As a CSE Student, I want priority access
to CSE Labs, while others are blocked."
• Task 1: Implement middleware to
compare User.Department vs
Room.Department.
• Task 2: Add time-based override logic
(e.g., allow cross-dept booking after 6 PM).
3. Design 4. Testing (AC)
• UI: "Locked for CSE Dept" overlay.
• Msg: "Available to you after 6 PM".
• Given I am from ECE,
• When I try to book a CSE Lab at 10 AM,
• Then the system should reject the
request.
Epic 2: Intelligent Allocation & AI Demand Forecasting
Goal: Use data to optimize resource usage.
User Story 2.1: Forecast Visualization
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to see a graph of
predicted demand, so I can staff
accordingly."
• Task 1: Train a Scikit-Learn regression
model on historical booking logs.
• Task 2: Build a frontend chart using
Chart.js or Recharts to visualize prediction
vs actual.
3. Design 4. Testing (AC)
• UI: Dashboard widget "Predicted Load".
• Legend: Dotted line = Prediction.
• Given historic data shows high usage on
Fridays,
• When I view next Friday,
• Then the graph should show a peak.
User Story 2.2: Smart Room Recommendation
1. User Story 2. Implementation (Tasksets)
"As a System, I want to suggest the
optimal room, so users don't waste large
halls."
• Task 1: Create a ranking algorithm: Score
= (RoomCapacity - UserHeadcount).
• Task 2: Sort search results by ascending
Score (closest fit first).
3. Design 4. Testing (AC)
• UI: "Best Match" highlight tag.
• Prompt: "Try Room 202 (Better Fit)".
• Given I need 10 seats,
• When I search,
• Then the system suggests a 15-seater,
not a 100-seater.
User Story 2.3: Alternative Slot Suggestion
1. User Story 2. Implementation (Tasksets)
"As a System, I want to suggest nearby
slots if the desired one is full, to help the
user."
• Task 1: If booking fails, query for free
slots in Time +/- 2 hours range.
• Task 2: Return "Alternatives" array in the
API error response.
3. Design 4. Testing (AC)
• UI: "Room busy. Available at 3:00 PM?".
• Action: One-click book alternative.
• Given 2 PM is booked,
• When I try to book,
• Then system suggests 3 PM or 4 PM.
User Story 2.4: Underutilization Alert
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to know which
rooms are rarely used, so I can repurpose
them."
• Task 1: Write an SQL aggregation query
for AVG(hours_booked) grouped by room.
• Task 2: Create a dashboard alert for
rooms falling below 10% utilization
threshold.
3. Design 4. Testing (AC)
• UI: "Inefficient Assets" Report.
• Color: Blue highlight on heatmap.
• Given Room Z was empty all month,
• When report runs,
• Then Room Z appears in the
"Underutilized" list.
User Story 2.5: Peak Hour Pricing (Credits)
1. User Story 2. Implementation (Tasksets)
"As a System, I want to charge higher
quota points for peak hours, to spread
demand."
• Task 1: Define a configuration for Peak
Hours (e.g., 9 AM - 5 PM).
• Task 2: Update quota deduction logic:
Cost = Duration * (IsPeak ? 2 : 1).
3. Design 4. Testing (AC)
• UI: Icon "High Demand (2 Credits)".
• Cart: Total Credits calculation.
• Given I book at 10 AM (Peak),
• When I confirm,
• Then 2 credits are deducted instead of 1.
User Story 2.6: Maintenance Scheduler
1. User Story 2. Implementation (Tasksets)
"As a System, I want to auto-schedule
cleaning during gaps, minimizing
disruption."
• Task 1: Write an algorithm to find time
gaps > 1 hr between existing bookings.
• Task 2: Create a script to auto-insert a
"Maintenance" block in these gaps.
3. Design 4. Testing (AC)
• UI: Grey slot "Cleaning in progress".
• Notify: Cleaning staff app.
• Given a gap between 2 PM and 4 PM,
• When the scheduler runs,
• Then a cleaning slot is booked at 2:05
PM.
User Story 2.7: Event Impact Analysis
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to see how a large
event affects campus capacity, for
planning."
• Task 1: Build a simulation logic that
temporarily blocks sets of rooms in
memory.
• Task 2: Calculate and display the
resulting % Availability metric.
3. Design 4. Testing (AC)
• UI: Scenario Builder Modal.
• Result: "Campus will be 90% full".
• Given I select "Tech Fest" scenario,
• When I run simulation,
• Then it warns "Parking capacity
exceeded".
User Story 2.8: User Trend Analytics
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to identify 'Power
Users', to understand demand sources."
• Task 1: Query Bookings table grouping by
user_id sorted by total duration.
• Task 2: Create an API to serve the Top 10
users list.
3. Design 4. Testing (AC)
• UI: Leaderboard view.
• Action: "Award Bonus Quota".
• Given User A booked 50 hours,
• When I check stats,
• Then User A is #1 on the list.
User Story 2.9: Anomaly Detection
1. User Story 2. Implementation (Tasksets)
"As a System, I want to flag unusual
booking patterns, to detect bots/abuse."
• Task 1: Implement rate limiting and
pattern matching (>5 bookings/min).
• Task 2: Create a "Suspicious" flag on
user accounts that triggers admin review.
3. Design 4. Testing (AC)
• UI: Alert Bell in Admin Dashboard.
• Status: "Suspicious Activity".
• Given a script sends 10 requests/sec,
• When it hits the limit,
• Then the account is locked automatically.
User Story 2.10: Fairness Score Calculation
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to see a 'Fairness
Score' for departments, ensuring equity."
• Task 1: Calculate usage ratio:
(Dept_Usage_Hours / Dept_Headcount).
• Task 2: Visualize deviation from the
campus average.
3. Design 4. Testing (AC)
• UI: Pie Chart "Resource Distribution".
• Alert: "ECE is underserved".
• Given CSE uses 80% resources,
• When I check the score,
• Then CSE shows "Over-consuming".
Epic 3: Real-Time Utilization & Ghost Booking Prevention
Goal: Ensure bookings match reality.
User Story 3.1: QR Code Check-In
1. User Story 2. Implementation (Tasksets)
"As a User, I want to scan a QR code to
check in, proving I am physically present."
• Task 1: Integrate a QR scanner library in
the mobile view.
• Task 2: Build API to validate the scanned
room ID matches the booking.
3. Design 4. Testing (AC)
• UI: "Scan to Unlock" button.
• Physical: Unique QR on door.
• Given I have a booking,
• When I scan the correct QR,
• Then status updates to "Occupied".
User Story 3.2: Auto-Cancel Ghost Bookings
1. User Story 2. Implementation (Tasksets)
"As a System, I want to release the room
if no check-in occurs, freeing it up."
• Task 1: Setup a cron job running every 5
mins.
• Task 2: Logic: UPDATE bookings SET
status='cancelled' WHERE start < now-15m
AND status='pending'.
3. Design 4. Testing (AC)
• Notify: "Cancelled due to No-Show".
• Penalty: Deduct reputation.
• Given 15 mins passed without scan,
• When the cron runs,
• Then the room becomes Green (Free)
again.
User Story 3.3: Live Occupancy View
1. User Story 2. Implementation (Tasksets)
"As a Student, I want to see what is free
RIGHT NOW, for study space."
• Task 1: API Query: Status='Free' AND
Next_Book > Now+1h.
• Task 2: Use WebSockets or Polling to
keep the status live.
3. Design 4. Testing (AC)
• UI: "Available Now" Widget.
• Color: Pulse animation for live status.
• Given Room A is booked but empty,
• When I check,
• Then it shows "Pending Check-in" (Not
free yet).
User Story 3.4: Early Checkout
1. User Story 2. Implementation (Tasksets)
"As a User, I want to checkout early, to
return unused credits."
• Task 1: Update end_time = Now in DB.
• Task 2: Calculate refund amount and
update user balance.
3. Design 4. Testing (AC)
• UI: "End Meeting" button.
• Feedback: "Refunded 0.5 Credits".
• Given I booked 2 hrs but finish in 1,
• When I click End,
• Then the room becomes available
immediately.
User Story 3.5: Extend Meeting
1. User Story 2. Implementation (Tasksets)
"As a User, I want to extend my slot, if the
room is free."
• Task 1: Check availability for Now + 30m.
• Task 2: Update booking record if no
overlap.
3. Design 4. Testing (AC)
• UI: "+15 Mins" floating button.
• Error: "Next booking starts in 5 mins".
• Given the room is free for the next hour,
• When I click Extend,
• Then my end time updates.
User Story 3.6: Meeting Room Display Mode
1. User Story 2. Implementation (Tasksets)
"As a Visitor, I want to see the schedule
on a tablet outside the door, to know
availability."
• Task 1: Create a "Kiosk Mode" frontend
route (/display/:id).
• Task 2: Implement auto-refresh logic
every 60 seconds.
3. Design 4. Testing (AC)
• UI: Large Text: "Occupied until 4 PM".
• Next: "Next: Java Class".
• Given a tablet mounted on wall,
• When booking status changes,
• Then tablet updates without touch.
User Story 3.7: Waitlist Notification
1. User Story 2. Implementation (Tasksets)
"As a User, I want to join a waitlist for a
busy room, to get notified if it frees up."
• Task 1: Create Waitlist table linking Users
to Bookings.
• Task 2: On cancellation, trigger email to
top 5 waitlisted users.
3. Design 4. Testing (AC)
• UI: "Notify Me" bell icon.
• Msg: "Room 101 is now free!".
• Given I am on waitlist,
• When the current user cancels,
• Then I receive an instant alert.
User Story 3.8: Check-In Reminder
1. User Story 2. Implementation (Tasksets)
"As a User, I want a reminder 5 mins
before start, so I don't forget to check in."
• Task 1: Schedule a job (BullMQ) for
Start_Time - 5 mins.
• Task 2: Integrate with Push Notification
service.
3. Design 4. Testing (AC)
• Msg: "Scan QR in 5 mins to keep slot".
• Action: Tap to view QR code.
• Given my booking is at 10:00,
• When it is 9:55,
• Then my phone vibrates with reminder.
User Story 3.9: Location Verification (GPS)
1. User Story 2. Implementation (Tasksets)
"As a System, I want to ensure check-in
happens AT the venue, to prevent remote
cheating."
• Task 1: Get GPS coords from browser
API.
• Task 2: Calculate distance to Room
Coords (must be < 50m).
3. Design 4. Testing (AC)
• Error: "You are too far to check in".
• Override: Admin can bypass.
• Given I am in the hostel,
• When I try to check in to Lab,
• Then system rejects it "Location
Mismatch".
User Story 3.10: Biometric Auth (Optional)
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want fingerprint/face
check-in for high-security labs, for
audit."
• Task 1: Integrate WebAuthn API.
• Task 2: Log authentication method in
Audit trail.
3. Design 4. Testing (AC)
• UI: "Verify Identity" prompt.
• Fallback: PIN code.
• Given a secure lab booking,
• When I verify face,
• Then access is granted.
Epic 4: Governance, Fairness & Approval Workflows
Goal: Enforce rules and equitable access.
User Story 4.1: Weekly Quota Limit
1. User Story 2. Implementation (Tasksets)
"As a System, I want to limit Students to 4
hours/week, so everyone gets a chance."
• Task 1: Write middleware to sum duration
of user bookings for current week.
• Task 2: Block new booking if Sum + New
> Limit.
3. Design 4. Testing (AC)
• UI: Progress Bar "2/4 Hours Used".
• Error: "Weekly Quota Exceeded".
• Given I used 3.5 hours,
• When I try to book 1 hour,
• Then system blocks it.
User Story 4.2: Approval Request
1. User Story 2. Implementation (Tasksets)
"As a Student, I want to request access to
the Auditorium, subject to approval."
• Task 1: Set booking status to
Pending_Approval initially.
• Task 2: Trigger email notification to the
Hall_Admin.
3. Design 4. Testing (AC)
• UI: "Request Booking" button (not Book).
• Status: Yellow badge "Under Review".
• Given I request the Hall,
• When I submit,
• Then the slot is reserved provisionally.
User Story 4.3: Admin Approval Action
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to Approve or Reject
requests, to control usage."
• Task 1: API PATCH /booking/:id to update
status.
• Task 2: Require "Rejection Reason" text if
rejected.
3. Design 4. Testing (AC)
• UI: Inbox with "Approve" (Green) /
"Reject" (Red).
• Notify: Student gets email.
• Given a pending request,
• When I click Approve,
• Then status becomes Confirmed.
User Story 4.4: Emergency Override
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to cancel existing
bookings for Exams, which have priority."
• Task 1: Logic to force cancel conflicting
slots regardless of status.
• Task 2: Trigger "Emergency Cancellation"
email template.
3. Design 4. Testing (AC)
• UI: "Force Book" toggle.
• Modal: Warning "Will cancel 3 user
bookings".
• Given student bookings exist,
• When Admin force books,
• Then student bookings are cancelled +
notified.
User Story 4.5: Blacklisting Logic
1. User Story 2. Implementation (Tasksets)
"As a System, I want to ban users who
have 3 No-Shows, to prevent abuse."
• Task 1: Increment Ghost_Count on
auto-cancellation.
• Task 2: If count > 3, set is_blocked=true
until expiry date.
3. Design 4. Testing (AC)
• UI: "Account Suspended" banner.
• Duration: 7 days.
• Given I missed 3 bookings,
• When I try to book 4th,
• Then system says "You are banned".
User Story 4.6: Departmental Quotas
1. User Story 2. Implementation (Tasksets)
"As a System, I want to reserve 50% of
slots for the owning Department, for
priority."
• Task 1: Check if User.Dept !=
Room.Owner.
• Task 2: If true, count Non_Dept_Bookings
and block if > 50%.
3. Design 4. Testing (AC)
• UI: "Limited Availability for Non-CSE".
• Filter: Show only general slots.
• Given quota full for outsiders,
• When ECE student tries CSE lab,
• Then fail.
User Story 4.7: Faculty Unlimited Access
1. User Story 2. Implementation (Tasksets)
"As a System, I want to exempt Faculty
from quotas, to support teaching."
• Task 1: Middleware check: If Role ==
Faculty, Skip Quota Check.
• Task 2: Log usage but do not block.
3. Design 4. Testing (AC)
• UI: "Unlimited Access" badge on profile.
• Limit: None.
• Given I am Faculty,
• When I book 20 hours,
• Then system allows it.
User Story 4.8: Guest Booking (External)
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to book for an
external guest, who doesn't have a login."
• Task 1: Create "Guest" flag in booking
schema.
• Task 2: Store Guest Name/Phone in
metadata column.
3. Design 4. Testing (AC)
• UI: "Guest Booking" tab.
• Log: "Booked by Admin for Guest X".
• Given a guest speaker,
• When Admin books,
• Then slot is blocked with Guest details.
User Story 4.9: Audit Logs
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to see who deleted a
booking, for accountability."
• Task 1: Create AuditLog table.
• Task 2: Add DB triggers to insert row on
every Insert/Update/Delete.
3. Design 4. Testing (AC)
• UI: "Activity Log" table.
• Filter: By Date / User.
• Given Admin A cancelled User B,
• When I view logs,
• Then I see "Admin A cancelled Booking
#123".
User Story 4.10: Fairness Policy Display
1. User Story 2. Implementation (Tasksets)
"As a Student, I want to read the booking
rules, so I know why I was blocked."
• Task 1: Create an API to fetch current
rules/limits.
• Task 2: Display dynamic "Usage vs Limit"
stats.
3. Design 4. Testing (AC)
• UI: "Rules" Modal on Dashboard.
• Text: "Max 4h/week. Penalty for
No-Show".
• Given I am new,
• When I click Help,
• Then I see the fairness rules.
Epic 5: Admin Management & Facility Configuration
Goal: Setup and maintain the resource inventory.
User Story 5.1: Add New Room
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to add a new room
with capacity and amenities, to update
inventory."
• Task 1: Create POST /api/rooms endpoint.
• Task 2: Add unique constraint check for
room names.
3. Design 4. Testing (AC)
• UI: "Add Room" Wizard.
• Input: Name, Dept, Capacity, Amenities
tags.
• Given a new lab opens,
• When I add it,
• Then it appears in search immediately.
User Story 5.2: Manage Amenities
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to update
equipment list (e.g., Projector Broken),
to inform users."
• Task 1: Schema update for is_functional
flag.
• Task 2: API to toggle status and trigger
warnings.
3. Design 4. Testing (AC)
• UI: Chip list with Edit icon.
• Display: Strikethrough for broken items.
• Given projector breaks,
• When I update status,
• Then users see "Projector Unavailable".
User Story 5.3: Bulk Import Timetable
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to upload the
semester timetable (CSV), to block class
slots."
• Task 1: Client-side CSV parsing
(PapaParse).
• Task 2: Loop logic to create recurring
bookings for the semester.
3. Design 4. Testing (AC)
• UI: Drag-Drop CSV area.
• Preview: Table of valid rows vs errors.
• Given a CSV with 500 classes,
• When I upload,
• Then system books them all in < 10s.
User Story 5.4: User Role Management
1. User Story 2. Implementation (Tasksets)
"As an Super Admin, I want to promote a
user to 'Lab Admin', so they can approve
requests."
• Task 1: API to update user.role column.
• Task 2: Logic to invalidate/refresh user
tokens.
3. Design 4. Testing (AC)
• UI: User Search $\rightarrow$ Role
Dropdown.
• Effect: User gains new menu items.
• Given a new staff member,
• When I set role to Admin,
• Then they can see the Approval Inbox.
User Story 5.5: Holiday Calendar
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to mark Public
Holidays, so no bookings are allowed."
• Task 1: BlockedDates table and check
logic.
• Task 2: Batch job to cancel existing
bookings on new holiday.
3. Design 4. Testing (AC)
• UI: Calendar Click $\rightarrow$ "Mark
Holiday".
• Visual: Grey out entire day.
• Given Oct 2 is holiday,
• When student tries booking,
• Then "Campus Closed" error appears.
User Story 5.6: Export Booking Data
1. User Story 2. Implementation (Tasksets)
"As a Dean, I want to download a CSV of
all bookings, for offline audit."
• Task 1: Stream DB results to CSV format.
• Task 2: Set headers for browser
download attachment.
3. Design 4. Testing (AC)
• UI: "Export Data" button with Date Range.
• Format: Excel-compatible CSV.
• Given I need monthly report,
• When I click export,
• Then file downloads with correct
columns.
User Story 5.7: Room Maintenance Mode
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to mark a room
'Under Maintenance', blocking all slots."
• Task 1: Update room status logic.
• Task 2: Trigger auto-cancel for future
bookings + Email.
3. Design 4. Testing (AC)
• UI: "Block Room" toggle.
• Notify: Alert affected users.
• Given room painting starts,
• When I activate maintenance,
• Then calendar blocks the whole week.
User Story 5.8: Feedback Review
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to read user
feedback about rooms, to fix issues."
• Task 1: API to fetch feedback joined with
Room data.
• Task 2: Logic to resolve/close feedback
items.
3. Design 4. Testing (AC)
• UI: Feed of comments.
• Tag: "AC Issue" / "Cleanliness".
• Given user reported "Dirty Lab",
• When I open feedback,
• Then I see the comment.
User Story 5.9: System Configuration
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to change global
settings (e.g., Opening Hours),
dynamically."
• Task 1: Persistent Config store
(DB/Redis).
• Task 2: Update validation middleware to
use config.
3. Design 4. Testing (AC)
• UI: Settings Form.
• Param: "Campus Open: 8 AM - 8 PM".
• Given I change close time to 6 PM,
• When user checks 7 PM slot,
• Then it shows closed.
User Story 5.10: Dept Management
1. User Story 2. Implementation (Tasksets)
"As an Admin, I want to create/edit
Departments, to organize rooms."
• Task 1: CRUD APIs for Departments.
• Task 2: Relationship handling for Room
assignment.
3. Design 4. Testing (AC)
• UI: Dept List.
• Action: Assign "Head of Dept" user.
• Given a new "AI Dept",
• When I create it,
• Then I can assign labs to it.
Epic 6: Infrastructure, DevOps & Reporting
Goal: Reliability, Security, and Monitoring.
User Story 6.1: CI/CD Pipeline
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want auto-deployment on
push, so the site is always live."
• Task 1: Create .yml workflow for GitHub
Actions.
• Task 2: Configure secrets and
deployment hooks to Render/AWS.
3. Design 4. Testing (AC)
• Config: .yml workflow.
• Secret: Prod Keys injection.
• Given I merge to main,
• When tests pass,
• Then live URL updates.
User Story 6.2: Automated DB Backups
1. User Story 2. Implementation (Tasksets)
"As a System, I want daily backups, so we
don't lose booking data."
• Task 1: Script pg_dump execution.
• Task 2: Upload dump to S3 bucket via
cron.
3. Design 4. Testing (AC)
• Retention: Keep last 30 days.
• Alert: Email on failure.
• Given it is 2 AM,
• When cron runs,
• Then backup file appears in S3.
User Story 6.3: API Rate Limiting
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want to limit API requests, to
prevent DDoS."
• Task 1: Implement express-rate-limit
middleware.
• Task 2: Configure rules (100 req/min per
IP).
3. Design 4. Testing (AC)
• Error: 429 Too Many Requests.
• Header: Retry-After.
• Given I spam reload,
• When I hit 101 requests,
• Then I get blocked.
User Story 6.4: Swagger Documentation
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want interactive API docs, for
easier frontend integration."
• Task 1: Set up swagger-jsdoc to parse
comments.
• Task 2: Host Swagger UI at /api-docs
route.
3. Design 4. Testing (AC)
• UI: Web page with "Try it out" button.
• Auth: Bearer Token support.
• Given I need to test Login API,
• When I use Swagger,
• Then I get a valid response.
User Story 6.5: Performance Monitoring
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want to track API latency, to
fix slow endpoints."
• Task 1: Integrate Prometheus/New Relic
agent.
• Task 2: Log response times for every
request.
3. Design 4. Testing (AC)
• Alert: "High Latency > 1s".
• Log: Identify slow queries.
• Given search is slow,
• When I check dashboard,
• Then I see the spike.
User Story 6.6: Monthly Utilization Report (PDF)
1. User Story 2. Implementation (Tasksets)
"As a Dean, I want a PDF report of
efficiency, sent to my email."
• Task 1: Use pdfkit to generate layout from
data.
• Task 2: Implement email attachment logic
(Nodemailer).
3. Design 4. Testing (AC)
• Format: Professional Header/Footer.
• Data: Usage %.
• Given end of month,
• When report generates,
• Then PDF contains correct stats.
User Story 6.7: Secure Headers
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want security headers
(Helmet), to prevent XSS attacks."
• Task 1: Install helmet middleware.
• Task 2: Configure CSP and HSTS policies.
3. Design 4. Testing (AC)
• Check: SecurityAudit site.
• Score: Grade A.
• Given hacker tries XSS,
• When headers active,
• Then browser blocks script.
User Story 6.8: Docker Containerization
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want to run the app in
Docker, for consistent dev env."
• Task 1: Write Dockerfile for Node API.
• Task 2: Create docker-compose for
App+DB+Redis.
3. Design 4. Testing (AC)
• Cmd: docker-compose up.
• Vol: Persist DB data.
• Given new laptop,
• When I run docker up,
• Then app starts perfectly.
User Story 6.9: Error Logging (Sentry)
1. User Story 2. Implementation (Tasksets)
"As a Dev, I want centralized crash logs,
to debug production issues."
• Task 1: Initialize Sentry SDK in app entry
point.
• Task 2: Create middleware to
capture/report uncaught exceptions.
3. Design 4. Testing (AC)
• Dash: Stack Trace view.
• Tag: User ID, Browser version.
• Given app crashes,
• When I check Sentry,
• Then I see the line number.
User Story 6.10: Redis Caching
1. User Story 2. Implementation (Tasksets)
"As a System, I want to cache room
details, to reduce DB load."
• Task 1: Middleware to check Redis before
DB query.
• Task 2: Cache invalidation logic on Room
Update.
3. Design 4. Testing (AC)
• Key: rooms_list.
• Invalidate: On Update Room.
• Given I load home page,
• When I reload,
• Then response is instant (from cache).