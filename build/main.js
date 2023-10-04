let callbacks = {};
let debug_registration;

function showError(error) {
  console.error(error);
  document.querySelector("[data-error]").style = "display:block;";
  document.querySelector("[data-error]").innerText = error;
}

// Thanks https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function dec2hex(dec) {
  return dec.toString(16).padStart(2, "0");
}

function generateId(len) {
  var arr = new Uint8Array((len || 40) / 2);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}

function workerRequest(registration, route, data, callback) {
  const message = {
    route: route,
    data: data,
  };
  if (callback) {
    const callbackId = generateId(32);
    callbacks[callbackId] = callback;
    message.callbackId = callbackId;
  }
  registration.active.postMessage(message);
}

function initBehaviors(registration) {
  debug_registration = registration;

  workerRequest(registration, "GetInitialData", {}, (data) => {
    const elem = document.querySelector("[data-login-status]");
    if (data.username) {
      elem.innerText = `Welcome back, ${data.username}`;
    } else {
      elem.innerHTML = '<a href="/login">Login</a>';
    }
  });

  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      workerRequest(
        registration,
        "Login",
        {
          username: loginForm.elements.username.value,
          password: loginForm.elements.password.value,
        },
        (data) => {
          if (data.status && data.status === "ok") {
            window.location = `/welcome?message=Welcome! There's not much here now but as soon as we figure out FDIC insurance for cold wallets we'll be ready to go.`;
          } else {
            showError(data.error);
          }
        }
      );
    });
  }

  const userDetails = document.querySelector("[data-user-details]");
  if (userDetails) {
    workerRequest(
      registration,
      "ViewUser",
      {
        username: userDetails.getAttribute("data-user-details"),
      },
      (data) => {
        if (data.error) {
          showError(data.error);
        } else {
          userDetails.innerText = `Full name: ${data.full_name}\nAdmin: ${data.admin}`;
        }
      }
    );
  }

  const webhookForm = document.querySelector("[data-debug-webhook-form]");
  if (webhookForm) {
    webhookForm.addEventListener("submit", (e) => {
      e.preventDefault();
      workerRequest(
        registration,
        "DebugWebhook",
        {
          path: webhookForm.elements.path.value,
          payload: webhookForm.elements.payload.value,
        },
        (data) => {
          if (data.result) {
            alert("Got webhook response: " + JSON.stringify(data.result));
          } else {
            showError(JSON.stringify(data));
          }
        }
      );
    });
  }

  const welcomeMessage = document.querySelector("[data-welcome-message]");
  if (welcomeMessage) {
    welcomeMessage.innerHTML = new URLSearchParams(location.search).get(
      "message"
    );
  }

  const userSearchForm = document.querySelector("[data-search-users-form]");
  const userSearchResults = document.querySelector(
    "[data-search-users-results]"
  );
  if (userSearchForm && userSearchForm) {
    userSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      userSearchResults.innerText = "";
      workerRequest(
        registration,
        "Users",
        {
          username: userSearchForm.elements.username.value,
          sort: "ASC",
        },
        (data) => {
          if (data.users) {
            data.users.forEach((user) => {
              const a = document.createElement("a");
              a.href = `/user/${user}`;
              a.innerText = user;
              a.classList.add("list-group-item", "list-group-item-action");
              userSearchResults.append(a);
            });
          } else {
            showError(JSON.stringify(data));
          }
        }
      );
    });
  }
}

navigator.serviceWorker.register("/worker.js").then((registration) => {
  registration.update();
  if (!registration.active) {
    location.reload();
  }
  registration.active.postMessage({ realPath: window.location.pathname });

  setInterval(() => {
    registration.active.postMessage({ keepAlive: true });
  }, 2000);

  if (document.readyState === "complete") {
    initBehaviors(registration);
  } else {
    window.addEventListener("load", () => {
      initBehaviors(registration);
    });
  }
});

navigator.serviceWorker.addEventListener("message", (event) => {
  console.log("Message from worker: ", event.data);
  if (event.data.callbackId in callbacks) {
    callbacks[event.data.callbackId](event.data);
    delete callbacks[event.data.callbackId];
  }
});
