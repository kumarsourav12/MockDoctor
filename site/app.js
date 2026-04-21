const demoCases = {
  schema: {
    bullets: [
      "Compares GET /api/orders/{id} after path normalization.",
      "Loads the OpenAPI schema for the 200 response.",
      "Runs Ajv validation and reports the exact failing path."
    ],
    description:
      "The contract says amount is an integer. The mock still returns it as a string, so the comparison fails at the exact field instead of producing a vague drift warning.",
    kicker: "Most common catch",
    output: `$ mockdoctor compare \\
  --readyapi ./orders-project-schema-drift.xml \\
  --openapi ./orders-openapi.yaml

MockDoctor
ReadyAPI: ./orders-project-schema-drift.xml
Contract: ./orders-openapi.yaml (openapi)
Services checked: 1
Operations checked: 3
Responses checked: 4
Issues found: 1

GET /api/orders/{id} | service=OrdersService
  - [response-body-schema-mismatch]
    ReadyAPI response OK Response does not match the contract schema.
      $.amount: must be integer`,
    title: "The body parses, but the types drifted."
  },
  response: {
    bullets: [
      "Matches the same operation key on both sides.",
      "Tracks which contract responses were satisfied by the mock.",
      "Reports concrete status codes the virtual service forgot to implement."
    ],
    description:
      "The contract added a response, but the ReadyAPI virtual service never grew that branch. MockDoctor treats that as drift because clients can now see behavior the mock does not model.",
    kicker: "Contract expanded",
    output: `$ mockdoctor compare \\
  --readyapi ./orders-project.xml \\
  --openapi ./orders-openapi-extra-response.yaml

MockDoctor
ReadyAPI: ./orders-project.xml
Contract: ./orders-openapi-extra-response.yaml (openapi)
Services checked: 1
Operations checked: 3
Responses checked: 4
Issues found: 1

GET /api/orders | service=OrdersService
  - [response-missing-in-readyapi]
    Contract response 206 for GET /api/orders is missing from the ReadyAPI virtual service.`,
    title: "The contract grew a response your mock does not have."
  },
  content: {
    bullets: [
      "Matches the response status first, then the media type.",
      "Flags the mismatch even when the body still exists.",
      "Keeps non-JSON validation narrow and predictable."
    ],
    description:
      "Content-type drift is easy to miss in review. The response still exists, but clients that key off the media type now behave differently than the mock.",
    kicker: "Silent mismatch",
    output: `$ mockdoctor compare \\
  --readyapi ./orders-project.xml \\
  --openapi ./orders-openapi-health-json.yaml

MockDoctor
ReadyAPI: ./orders-project.xml
Contract: ./orders-openapi-health-json.yaml (openapi)
Services checked: 1
Operations checked: 3
Responses checked: 4
Issues found: 1

GET /api/health | service=OrdersService
  - [content-type-mismatch]
    ReadyAPI response OK Response for GET /api/health uses text/plain,
    but the contract expects application/json.`,
    title: "The response exists, but the declared media type changed."
  }
};

const copyButton = document.querySelector("[data-copy-text]");
const copyFeedback = document.querySelector(".copy-feedback");
const demoButtons = [...document.querySelectorAll("[data-demo]")];
const demoTitle = document.querySelector("#demo-title");
const demoDescription = document.querySelector("#demo-description");
const demoKicker = document.querySelector("#demo-kicker");
const demoBullets = document.querySelector("#demo-bullets");
const demoOutput = document.querySelector("#demo-output code");
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".topnav a")];
const reveals = [...document.querySelectorAll(".reveal")];

if (copyButton && copyFeedback) {
  copyButton.addEventListener("click", async () => {
    const copyText = copyButton.getAttribute("data-copy-text") ?? "";

    try {
      await navigator.clipboard.writeText(copyText);
      copyFeedback.textContent = "Quick-start command copied.";
    } catch {
      copyFeedback.textContent = "Clipboard access failed. Copy the command from the button text.";
    }

    window.setTimeout(() => {
      copyFeedback.textContent = "";
    }, 2200);
  });
}

function renderDemo(key) {
  const activeDemo = demoCases[key];
  if (!activeDemo || !demoTitle || !demoDescription || !demoKicker || !demoBullets || !demoOutput) {
    return;
  }

  demoTitle.textContent = activeDemo.title;
  demoDescription.textContent = activeDemo.description;
  demoKicker.textContent = activeDemo.kicker;
  demoBullets.innerHTML = activeDemo.bullets.map((item) => `<li>${item}</li>`).join("");
  demoOutput.textContent = activeDemo.output;

  demoButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-demo") === key);
  });
}

demoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-demo");
    if (key) {
      renderDemo(key);
    }
  });
});

renderDemo("schema");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  {
    threshold: 0.18
  }
);

reveals.forEach((section) => revealObserver.observe(section));

const navObserver = new IntersectionObserver(
  (entries) => {
    const visibleEntry = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

    if (!visibleEntry) {
      return;
    }

    const activeId = visibleEntry.target.getAttribute("id");
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
    });
  },
  {
    rootMargin: "-30% 0px -40% 0px",
    threshold: [0.2, 0.45, 0.7]
  }
);

sections.forEach((section) => navObserver.observe(section));
