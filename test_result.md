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



user_problem_statement: "SpecTrun SW & Şakarlar - Internal warehouse mobile app. Fast, simple, never crashes. Features: 4 category filters (Tümü/Temizlik/Ambalaj/Gıda), Excel/CSV import (SheetJS, chunked, replace all), text paste import (upsert mode), fuzzy search with Turkish normalization, smart sorting (search_count + last_searched_at), barcode scanner with horizontal rectangle, speed mode. stock_quantity (integer) system with smart color indicators."

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
        comment: "v5 SEARCH REWRITE: Removed ts_to_neg/history bias from search mode. New get_search_score: Exact=100, Prefix=75, Token-Prefix=60, Contains=50, Fuzzy(≥60 threshold)×0.25. Tiebreaker: shorter product name = more specific. Browse mode still uses popularity sort. Tested: 'çöp poşeti' → 1809 results (was 21k), prefix matches ranked first correctly."

  - task: "POST /api/products/bulk - replace (Excel import) + upsert (text paste) modes"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "mode='replace': deletes all then inserts batches. mode='upsert': MongoDB bulk_write UpdateOne with upsert=True. Both tested via curl and UI. Verified 4 products inserted via text paste."

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
  - task: "Main screen - FlashList + stock_quantity badges"
    implemented: true
    working: true
    file: "frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "FlashList replaces FlatList for 30k+ performance. stock_quantity badges: >50 green, 10-50 yellow, 1-9 orange, 0 red Tükendi. Screenshot confirmed."

  - task: "Admin screen - Excel + Metin Yapıştır buttons + FlashList"
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
    message: "v5 SEARCH SYSTEM REWRITE COMPLETE:
    Backend (server.py):
    - Removed ts_to_neg history/date bias from SEARCH mode entirely
    - New get_search_score function: Exact=100, Prefix=75, Token-Prefix=60, Contains=50, Fuzzy(threshold=60)×0.25
    - Tiebreaker: shorter product name = more specific result
    - Fuzzy threshold raised 35→60 to eliminate noisy matches (21k→1.8k for 'çöp poşeti')
    - Browse mode (no query): still uses popularity sort (search_count + date)
    Frontend (index.tsx):
    - Removed setLoading(true) from immediate effect body (was firing on every keystroke = lag)
    - Added debouncePending state (visual indicator: yellow search icon during typing)
    - Debounce increased 150ms→300ms, setPage/setHasMore moved inside setTimeout
    - searchBoxActive style added (yellow border when debouncing)
    Verified: 'koli bandı' → KOLİ BANDI first, 'çöp poşeti' → ÇÖP POŞETİ 80*110 first (shortest prefix)"