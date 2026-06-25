import * as THREE from "three";

export const focusTargets = {
  profile: { position: new THREE.Vector3(0, 1.55, 6.8), target: new THREE.Vector3(0, 1.05, 0) },
  education: { position: new THREE.Vector3(0, -1.4, 7.2), target: new THREE.Vector3(0, -1.2, 0) },
  experience: { position: new THREE.Vector3(3.8, 3.0, 6.2), target: new THREE.Vector3(0.75, 2.7, 0) },
  skills: { position: new THREE.Vector3(-3.4, 4.7, 7.4), target: new THREE.Vector3(0, 4.15, 0) },
  projects: { position: new THREE.Vector3(2.9, 4.2, 5.8), target: new THREE.Vector3(0.8, 4.05, 0) },
  contact: { position: new THREE.Vector3(0, 5.4, 8.5), target: new THREE.Vector3(0, 4.3, 0) }
};

export const resumeTreeData = {
  seed: "Soumojit Dalui 2026 portfolio tree",
  experienceTypes: {
    production: { heightBias: -0.12, radiusBoost: 0.035, outwardBoost: 0.18, zBias: 0.08 },
    openSource: { heightBias: 0.18, radiusBoost: 0.02, outwardBoost: 0.12, zBias: -0.1 },
    academic: { heightBias: 0.26, radiusBoost: -0.004, outwardBoost: 0.02, zBias: 0.12 },
    personal: { heightBias: 0.08, radiusBoost: 0.004, outwardBoost: 0.04, zBias: 0.24 },
    prototype: { heightBias: 0.14, radiusBoost: -0.012, outwardBoost: -0.04, zBias: -0.24 },
    internship: { heightBias: -0.28, radiusBoost: -0.018, outwardBoost: -0.14, zBias: 0.18 }
  },
  trunk: {
    years: 4,
    productionWeight: 0.9,
    jobs: [
      { id: "yen", label: "Yen Digital", role: "Software Engineer Intern", period: "2019", weight: 0.34, y: -0.42, angle: 4.2 },
      { id: "minerva", label: "Minerva Technology Solutions", role: "Software Engineer Intern", period: "2021", weight: 0.5, y: 0.02, angle: 2.5 },
      { id: "ltimindtree", label: "LTIMindtree", role: "Software Engineer", period: "2021 - 2024", weight: 0.95, y: 0.72, angle: 0.28 }
    ],
    accomplishmentMarks: [
      { label: "2,000+ production issues", weight: 0.95 },
      { label: "3,500+ web components", weight: 0.8 },
      { label: "SQL migrations", weight: 0.78 },
      { label: "AWS serverless automation", weight: 0.72 },
      { label: "Azure OpenAI workflows", weight: 0.68 }
    ]
  },
  roots: [
    { id: "ms-cs", label: "M.S. Computer Science", weight: 0.95 },
    { id: "btech-cse", label: "B.Tech Computer Science", weight: 0.82 },
    { id: "ml-stanford", label: "Machine Learning", weight: 0.52 },
    { id: "iot-embedded", label: "IoT / Embedded Systems", weight: 0.42 }
  ],
  branches: [
    { id: "production", label: "Production Engineering", experienceType: "production", weight: 0.96, skills: ["frontend", "backend", "data", "cloud"] },
    { id: "backend", label: "Backend & APIs", experienceType: "production", weight: 0.84, skills: ["backend", "data", "cloud"] },
    { id: "data", label: "Data Systems", experienceType: "openSource", weight: 0.82, skills: ["data", "languages"] },
    { id: "ai", label: "AI / Retrieval", experienceType: "academic", weight: 0.72, skills: ["ai", "data", "languages"] },
    { id: "web", label: "Web Applications", experienceType: "personal", weight: 0.68, skills: ["frontend", "backend"] },
    { id: "xr", label: "Game / XR", experienceType: "prototype", weight: 0.46, skills: ["ai", "languages"] },
    { id: "internships", label: "Internships", experienceType: "internship", weight: 0.38, skills: ["languages", "data"] }
  ],
  skillClusters: [
    { id: "languages", label: "Languages", weight: 0.92, skills: ["Python", "TypeScript", "C#", "C++", "Rust", "SQL"] },
    { id: "backend", label: "Backend", weight: 0.9, skills: ["Node.js", "FastAPI", "REST", "OAuth", "ASP.NET"] },
    { id: "data", label: "Data", weight: 0.86, skills: ["PostgreSQL", "MySQL", "RocksDB", "MongoDB", "Similarity Search"] },
    { id: "frontend", label: "Frontend", weight: 0.74, skills: ["React", "Next.js", "Responsive UI", "Forms"] },
    { id: "cloud", label: "Cloud", weight: 0.68, skills: ["AWS Lambda", "S3", "Docker", "CI/CD", "Edge Functions"] },
    { id: "ai", label: "AI / ML", weight: 0.76, skills: ["Azure OpenAI", "PyTorch", "scikit-learn", "Gemini", "Codex"] }
  ],
  fruits: [
    { id: "makodb", label: "MakoDB Contribution", branch: "data", experienceType: "openSource", weight: 0.96 },
    { id: "scipy-search", label: "SciPy Codebase Search Assistant", branch: "ai", experienceType: "academic", weight: 0.78 },
    { id: "semantic-books", label: "Semantic Book Explorer", branch: "ai", experienceType: "academic", weight: 0.7 },
    { id: "sqmc", label: "SQMC Website", branch: "web", experienceType: "personal", weight: 0.72 },
    { id: "echoes", label: "Echoes of Two Realms", branch: "xr", experienceType: "prototype", weight: 0.62 },
    { id: "transfer-songs", label: "Transfer Songs", branch: "backend", experienceType: "personal", weight: 0.64 },
    { id: "nanogpt", label: "Domain Adaptation NanoGPT", branch: "ai", experienceType: "academic", weight: 0.56 }
  ]
};
