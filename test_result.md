#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



user_problem_statement: "Şakarlar SW - Internal warehouse mobile app. Fast, simple, never crashes. Features: 4 category filters (Tümü/Temizlik/Ambalaj/Gıda), Excel/CSV import (replace all products), fuzzy search with Turkish normalization, smart sorting (search_count + last_searched_at), barcode scanner with horizontal rectangle, speed mode."

backend:
  - task: "GET /api/products with category filter and fuzzy search"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Fully working with rapidfuzz, Turkish normalization, priority sorting"

  - task: "POST /api/products/import - Excel/CSV replace all products"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Updated to DELETE ALL + INSERT approach, tracks last_import, handles diger category, deduplicates by barcode"

  - task: "GET /api/settings - last import date"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "New endpoint added, confirmed in logs (200 OK)"

  - task: "GET /api/stats - category counts"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Returns total, temizlik, ambalaj, gida counts"

  - task: "POST /api/products/{id}/view - increment search count"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Working"

frontend:
  - task: "Main screen - 4 category filters + product list"
    implemented: true
    working: true
    file: "frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Screenshot confirmed: Tümü/Temizlik/Ambalaj/Gıda filters working, 55 products shown"

  - task: "Admin screen - stats + import + product list"
    implemented: true
    working: true
    file: "frontend/app/admin/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Fixed setGidaCount bug, fixed duplicate styles crash. Screenshot confirmed: 55/25/20/10 counts, Excel/CSV button visible"

  - task: "Admin add/edit screen - 3 category buttons"
    implemented: true
    working: true
    file: "frontend/app/admin/add.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Added Gıda category button. Screenshot confirmed all 3 buttons visible"

  - task: "Scanner - horizontal rectangle + speed mode"
    implemented: true
    working: true
    file: "frontend/app/scanner.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Working with animated scan line and corner guides"

  - task: "Product detail - correct category display"
    implemented: true
    working: true
    file: "frontend/app/product/[id].tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Fixed Gıda category color and label"

metadata:
  created_by: "main_agent"
  version: "3.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "POST /api/products/import - Excel/CSV replace all"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "v4 MAJOR UPDATE COMPLETE. All features implemented and screenshots verified:
    1. Branding: SpecTrun SW & Şakarlar with ST logo badge (gold) in header
    2. Admin auth: Settings → login (Emir/Ertekinelvan54) → AdminPanel. AsyncStorage persists auth.
    3. Admin protection: Auth gate shows on /admin and /admin/add when not logged in.
    4. Speed mode: 2 second delay + CameraView remount (scanKey) for proper camera reset.
    5. Scanner: Centered (vertically) with slightly taller frame (0.38 ratio).
    6. Stock status: var/az/yok with colored badges in list + detail page. Admin can edit.
    7. VAT price: vat_excluded_price field shown below main price on detail page.
    8. Colorful UI: Gold accent strip, colored category left stripes, vibrant filters.
    9. New backend endpoints: PUT /api/products/{id}/stock, GET /api/settings.
    10. Excel/CSV import handles stock_status and vat_excluded_price columns."