/** Shared state and configuration for the classrooms feature. **/
"use strict";

var API_URL = "../api/classrooms.php";

var INSTRUCTORS_API_URL = "../api/instructors.php";

var STORAGE_KEY = "ccis_classrooms_demo";

var ROOMS_SYNC_KEY = "ccis_rooms_sync";

var ROOM_TYPES = ["Lecture", "Laboratory"];

var STATUSES = ["Available", "Maintenance", "Unavailable", "Reserved", "Inactive"];

var FEATURES = [
        "Computers", "Projector", "Smart TV", "Whiteboard",
        "Air Conditioning", "Internet", "Laboratory Equipment", "Sound System"
    ];

var NAME_PREFIX_BY_TYPE = { Laboratory: "Computer Laboratory", Lecture: "Lecture Room" };

var CODE_CHECK_DEBOUNCE_MS = 400;

var INSTRUCTOR_SEARCH_DEBOUNCE_MS = 300;

var UNASSIGNED_FILTER_VALUE = "__unassigned__";

var ACTIVE_INSTRUCTOR_STATUS = "active";

var classrooms = [];

var instructors = [];

var roomModal = null;

var bulkModal = null;

var loadError = false;

var instructorsLoadError = false;

var isSaving = false;

var nameManuallyEdited = false;

var codeCheckTimer = null;

var sortState = { field: null, dir: "asc" };

var currentBulkPreview = [];

var roomInstructorSelector = null;

var bulkInstructorSelector = null;

var availabilityModal = null;

var availabilityRoomId = null;

var AVAILABILITY_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
