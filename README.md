# 🚼 DevPulse – Internal Tech Issue & Feature Tracker API

DevPulse is a robust, collaborative backend platform designed for software teams to efficiently report bugs, suggest new features, and coordinate workflow resolutions. Built with a modular architecture, it features secure authentication, role-based access control, and dynamic SQL query execution.

## 🔗 Live Deployment
**Live API URL:** [https://ass2pros.vercel.app](https://ass2pros.vercel.app)

---

## 🚀 Key Features
*   **Role-Based Access Control (RBAC):** Distinct permissions for `contributor` and `maintainer` roles.
*   **Secure Authentication:** JWT-based authentication with bcrypt password hashing.
*   **Dynamic Data Filtering:** Advanced dynamic SQL querying for sorting, and filtering issues without ORMs.
*   **Centralized Error Handling:** Global middleware for consistent, predictable error responses.
*   **Raw SQL Implementation:** Native PostgreSQL `pg` driver integration with parameterized queries to prevent SQL injection.

---

## 🛠️ Technology Stack
*   **Runtime:** Node.js (LTS)
*   **Framework:** Express.js
*   **Language:** TypeScript
*   **Database:** PostgreSQL (NeonDB/Supabase)
*   **DB Driver:** `pg` (Raw SQL, No Query Builders or ORMs)
*   **Security:** `bcrypt`, `jsonwebtoken`
*   **Deployment:** Vercel

---

## 🗄️ Database Schema Summary

### Table: `users`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer (PK) | Auto-incrementing unique identifier |
| `name` | String | Full display name of the user |
| `email` | String | Valid login address (Unique) |
| `password` | String | Encrypted password (Never returned in API) |
| `role` | Enum | `contributor` or `maintainer` |
| `created_at` | Timestamp | Account creation time |
| `updated_at` | Timestamp | Last update time |

### Table: `issues`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer (PK) | Auto-incrementing unique identifier |
| `title` | String | Short descriptive headline (Max 150 chars) |
| `description` | Text | Detailed explanation (Min 20 chars) |
| `type` | Enum | `bug` or `feature_request` |
| `status` | Enum | `open`, `in_progress`, or `resolved` |
| `reporter_id` | Integer (FK) | References `users.id` |
| `created_at` | Timestamp | Issue creation time |
| `updated_at` | Timestamp | Last update time |

---

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/signup` | Register a new user | Public |
| POST | `/api/auth/login` | Authenticate and get JWT token | Public |

### Issues
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| POST | `/api/issues` | Create a new bug or feature request | Authenticated |
| GET | `/api/issues` | Get all issues (supports `sort`, `type`, `status` query params) | Public |
| GET | `/api/issues/:id` | Get single issue details | Public |
| PATCH| `/api/issues/:id` | Update issue (Maintainer: Any, Contributor: Own & Open) | Authenticated |
| DELETE|`/api/issues/:id` | Delete an issue | Maintainer Only |

---

## 💻 Local Setup Instructions

Follow these steps to run the project locally on your machine:

**1. Clone the repository:**
```bash
git clone [https://github.com/yourusername/Assignmet-2.git](https://github.com/yourusername/Assignmet-2.git)
cd Assignmet-2
