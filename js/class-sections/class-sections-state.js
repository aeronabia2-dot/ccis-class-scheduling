/** Shared state and configuration for the class-sections feature. **/
"use strict";

var API_URL = "../api/class_sections.php";

var STORAGE_KEY = "ccis_class_sections_demo";

var SECTIONS_SYNC_KEY = "ccis_sections_sync";

var sections = [];

var sectionModal = null;

// Programs are a fixed, small set here (matches the single Add Section
// form's <select> options) - both the bulk generator and the single-add
// duplicate-name check reuse this list instead of re-declaring it.
var SECTION_PROGRAMS = ["BSIT", "BSCS", "BSIS", "BSEMC"];
var SECTION_YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

var bulkSectionModal = null;
var currentBulkSectionPreview = []; // [{ section_name, program, year_level, students, conflict, conflictReason }, ...]

var importSectionsModal = null;
var importSectionsParsedRows = []; // [{ section_name, program, year_level, students }, ...]
var importSectionsFileName = "";
var isImportingSections = false;

var sectionNameCheckTimer = null;
const SECTION_NAME_CHECK_DEBOUNCE_MS = 400;
