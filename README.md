# README for Plate Tracking System

## Plate Tracking System
The Plate Tracking System is designed to manage and track printing plate jobs. It features a dynamic front-end interface for viewing and interacting with individual plates in each job.

### Features

#### Front-End Operations
- **Job Display:** Dynamically displays jobs and their associated plates in a user-friendly interface.
- **Zoom Control:** Adjust the zoom level of the page for better visibility.
- **View Toggle:** Switch between individual plate or group listing.
- **Edit and Delete:** Edit individual plates within a job or delete entire jobs.
- **Context Menu:** Access additional options like filtering views, adjusting layouts, and toggling order views.
- **Authentication:** Securely authenticate users for privileged actions like deleting jobs.
- **Notifications and Alerts:** Receive real-time feedback on actions and system status.
- **Real-Time Updates:** Stay updated with real-time information via WebSocket connections.

#### Back-End Operations
- **File Monitoring:** Monitor a network path for new files and copy them to a local directory.
- **Job Management:** Process files, extract metadata, and organize them into corresponding jobs.
- **Error Handling:** Move files that do not conform to expected naming conventions to an error directory.
- **Log Management:** Log processed and unprocessed files with detailed information.
- **Scheduled Tasks:** Perform regular maintenance tasks like deleting old jobs and clearing incomplete file groups.

### File Structure
- `index.html`: Main HTML file that serves as the front-end interface.
- `index.js`: Server-side script handling HTTP requests, WebSocket connections, and scheduled tasks.
- `UNCBenderWatch.js`: Script for monitoring and processing files from a network path.
- `public/`: Directory containing static files served by the server.
- `logs/`: Directory for storing log files.
- `tmp/`: Directory for temporary files and processing logs.

### Front-End Operation Description
The front end of the Plate Tracking System provides a dynamic and interactive interface for managing printing plate jobs. When the page loads, it fetches job information from the server and displays it in a user-friendly format. Users can interact with the job listings through zoom controls, view toggles, context menus, and more. Real-time updates ensure that users always have the latest information without needing to refresh the page.

### Back-End Operation Description
The back end of the system is responsible for serving static files, processing client requests, managing WebSocket connections, and performing maintenance tasks. The UNCBenderWatch.js script monitors a network Nela Bender path for new files, processes them, and organizes them into directories. Scheduled tasks ensure the system remains organized by deleting old jobs and clearing incomplete file groups.

### Acknowledgements
- Node.js
- Express
- chokidar
- fs-extra
