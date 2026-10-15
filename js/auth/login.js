(() => {
    "use strict";

    const form = document.getElementById("loginForm");
    const alertBox = document.getElementById("loginAlert");
    const submitBtn = document.getElementById("loginSubmit");
    const submitText = submitBtn.querySelector(".login-submit-text");
    const spinner = document.getElementById("loginSpinner");
    const toggleBtn = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");

    // If already logged in, skip the login screen entirely.
    (async () => {
        try {
            const res = await fetch("api/auth.php?action=me", { headers: { "Accept": "application/json" } });
            if (res.ok) {
                const payload = await res.json();
                if (payload?.success) {
                    window.location.replace(redirectTarget());
                }
            }
        } catch (_) {
            // Ignore - just show the login form.
        }
    })();

    function redirectTarget() {
        const params = new URLSearchParams(window.location.search);
        return params.get("next") || "dashboard.html";
    }

    toggleBtn.addEventListener("click", () => {
        const isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";
        toggleBtn.querySelector("i").className = isHidden ? "fas fa-eye-slash" : "fas fa-eye";
        toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });

    function showError(message) {
        alertBox.textContent = message;
        alertBox.hidden = false;
    }

    function hideError() {
        alertBox.hidden = true;
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        spinner.classList.toggle("d-none", !isLoading);
        submitText.textContent = isLoading ? "Signing in\u2026" : "Sign In";
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideError();

        const username = document.getElementById("username").value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError("Please enter both your username and password.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("api/auth.php", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ action: "login", username, password })
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload?.success) {
                showError(payload?.message || "Invalid username or password.");
                setLoading(false);
                return;
            }

            window.location.href = redirectTarget();
        } catch (error) {
            showError("Couldn't reach the server. Please try again.");
            setLoading(false);
        }
    });
})();
