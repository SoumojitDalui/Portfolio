export const fridgePortfolio = {
  profile: {
    name: "Soumojit Dalui",
    role: "Software Engineer",
    location: "NYC",
    email: "soumdalui.jobs@gmail.com",
    github: "https://github.com/SoumojitDalui",
    source: "https://github.com/SoumojitDalui/Portfolio",
    tree: "./tree.html"
  },
  experience: [
    {
      id: "production",
      label: "Production Engineering",
      detail: "Resolved 2,000+ production issues across UI states, APIs, SQL, integrations, content, and performance."
    },
    {
      id: "modernization",
      label: "Backend Modernization",
      detail: "Moved ASP.NET workflows to Node.js while preserving API contracts, React behavior, and release paths."
    },
    {
      id: "data-migration",
      label: "Data Migration",
      detail: "Migrated MySQL workflows to PostgreSQL and validated queries, API responses, and stored outputs."
    },
    {
      id: "serverless",
      label: "AWS Serverless",
      detail: "Built C# Lambda and S3 workflows for event-driven file handling, validation, and automation."
    },
    {
      id: "localization",
      label: "Frontend Scale",
      detail: "Delivered reusable workflows across 11 languages and more than 3,500 web components."
    },
    {
      id: "ai-workflows",
      label: "AI Workflows",
      detail: "Supported Azure OpenAI chatbot flows with REST hooks, validation logic, and team handoff documentation."
    }
  ],
  academics: [
    {
      id: "ms-cs",
      label: "M.S. Computer Science",
      detail: "Stony Brook University · Expected 2027"
    },
    {
      id: "btech-cse",
      label: "B.Tech Computer Science",
      detail: "SRM Institute of Science and Technology · 2021"
    },
    {
      id: "supervised-ml",
      label: "Supervised Machine Learning",
      detail: "Regression and Classification · Stanford / Coursera"
    },
    {
      id: "machine-learning",
      label: "Machine Learning",
      detail: "Stanford / Coursera"
    },
    {
      id: "iot",
      label: "IoT & Embedded Systems",
      detail: "UC Irvine / Coursera"
    }
  ],
  shelves: [
    {
      id: "systems",
      domain: "Systems & Data",
      cuisine: "Indian tiffin",
      color: "#d98946",
      projects: [
        {
          label: "MakoDB Contribution",
          stack: "C++ · Rust · Python · RocksDB",
          detail: "Added persistence and replay support, completed the macOS ARM64 build path, fixed portability issues, and validated 68/68 tests.",
          url: "https://github.com/SoumojitDalui/makodb"
        },
        {
          label: "Consensus Ledger",
          stack: "Python · Paxos · 2PC",
          detail: "A sharded banking system exploring atomic cross-shard transactions and replicated consensus.",
          url: "https://github.com/SoumojitDalui/Consensus-Ledger"
        },
        {
          label: "Raft Consensus",
          stack: "C++ · Distributed Systems",
          detail: "A C++ implementation of replicated logs and strong consistency using the Raft consensus algorithm.",
          url: "https://github.com/SoumojitDalui/Raft-Consensus-Algorithm-Implementation-CPP"
        }
      ]
    },
    {
      id: "ai",
      domain: "AI & Retrieval",
      cuisine: "Chinese takeout",
      color: "#b74e3f",
      projects: [
        {
          label: "SciPy Search Assistant",
          stack: "Python · NumPy · scikit-learn",
          detail: "Semantic-style source and documentation search using chunking, TF-IDF, cosine similarity, and ranked developer context.",
          url: "https://github.com/SoumojitDalui/scipy-codebase-search-assistant"
        },
        {
          label: "Semantic Book Explorer",
          stack: "Python · Embeddings",
          detail: "Nearest-neighbor book discovery with similarity scoring and an interactive relationship map.",
          url: "https://github.com/SoumojitDalui/semantic-book-explorer"
        },
        {
          label: "Domain Adaptation NanoGPT",
          stack: "Python · PyTorch",
          detail: "Repeatable language-model adaptation experiments across datasets, checkpoints, and output quality signals.",
          url: "https://github.com/SoumojitDalui/domain-adaptation-nanogpt"
        }
      ]
    },
    {
      id: "web",
      domain: "Web Applications",
      cuisine: "Italian meal prep",
      color: "#4f815e",
      projects: [
        {
          label: "SQMC Website",
          stack: "Next.js · React · TypeScript",
          detail: "A public responsive website with API routes, validated forms, reusable UI, SEO pages, and Git-based delivery.",
          url: "https://github.com/SoumojitDalui/SQMCWebsite"
        },
        {
          label: "Invoice System",
          stack: "Django REST · React",
          detail: "A full-stack invoice management system designed around scalable APIs and practical operations workflows.",
          url: "https://github.com/SoumojitDalui/FullStack-Invoice-System"
        },
        {
          label: "Transfer Songs",
          stack: "Python · REST · OAuth",
          detail: "Transfers Spotify playlists to YouTube Music with matching, duplicate detection, rate-limit handling, and validation.",
          url: "https://github.com/SoumojitDalui/Transfer-Songs"
        }
      ]
    },
    {
      id: "xr",
      domain: "XR & Interaction",
      cuisine: "Japanese bento",
      color: "#657aa5",
      projects: [
        {
          label: "Echoes of Two Realms",
          stack: "Unity · C# · FastAPI · Gemini",
          detail: "A Meta Quest escape-room prototype combining interaction state, puzzles, scene transitions, and AI narration.",
          url: "https://github.com/SoumojitDalui/EchoesOfTwoRealms"
        },
        {
          label: "VR Campus Interaction",
          stack: "Unity XR · C#",
          detail: "A virtual campus exploring gaze selection, fruit collection, bird feeding, minimaps, and spatial teleportation.",
          url: "https://github.com/SoumojitDalui/vr-campus-3dui-bird-feeding"
        },
        {
          label: "Talk To Mute",
          stack: "Python · Audio Utility",
          detail: "A desktop utility that detects speech and triggers push-to-mute behavior for voice chat.",
          url: "https://github.com/SoumojitDalui/Talk_To_Mute"
        }
      ]
    }
  ],
  hobbies: [
    { label: "VR worldbuilding", detail: "Building playful spatial interactions and small puzzle worlds." },
    { label: "Music discovery", detail: "Exploring playlists, recommendation edges, and the occasional transfer script." },
    { label: "Open-source weekends", detail: "Reading unfamiliar systems code until the failure mode makes sense." },
    { label: "Book exploration", detail: "Following semantic connections between books, ideas, and technical interests." },
    { label: "Game prototyping", detail: "Turning interaction ideas into small playable systems." }
  ],
  blog: [
    {
      title: "Porting an unfamiliar database to macOS ARM64",
      summary: "What build failures, socket assumptions, and 68 passing tests taught me about entering a systems codebase."
    },
    {
      title: "Search tools should show their work",
      summary: "Notes from building inspectable retrieval over SciPy source and documentation."
    },
    {
      title: "Making a résumé explorable",
      summary: "Designing portfolio information as a place with objects, rules, and small games."
    }
  ]
};
