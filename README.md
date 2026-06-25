# 3D Portfolio Tree

Soumojit Dalui's portfolio rebuilt as a static Three.js experience.

The tree is generated from structured resume data:

- Roots: education and foundations
- Trunk: professional profile
- Branches: experience domains
- Leaves: skills
- Fruit: projects
- Orbiting nodes: contact links

## Procedural Model

The scene uses a resume-derived data object in `assets/js/data.js`.

```text
resume data -> weighted portfolio model -> deterministic tree layout -> Three.js scene
```

Current generated elements:

- Root length and marker size are based on education/certification weights.
- Trunk markers are generated from major accomplishments.
- Branch direction, radius, and endpoint are generated from work-domain weights.
- Experience type influences branch placement and prominence. Production work grows lower/thicker, open-source work pushes outward, academic/retrieval work sits higher, prototypes stay lighter, and internships remain smaller/lower.
- Skill clusters become canopy masses and leaf density.
- Project fruits are placed near their matching branch, sized by project weight, and colored by experience type.

The generator is seeded, so the same resume data produces the same tree. Changing weights, skills, branches, or projects changes the tree while keeping the overall style stable.

## Run Locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

Three.js is loaded from `unpkg` through an import map, so the site does not need a bundler or install step.

## Tree Generator Adapter

The app now has an `ez-tree` adapter in `assets/js/ezTreeAdapter.js`.

```text
resumeTreeData -> resumeToEzTreeOptions() -> @dgreenheck/ez-tree TreeOptions
```

The default route still uses the current portfolio-specific renderer. To inspect the generated `ez-tree` skeleton, open:

```text
http://localhost:8000/?skeleton=ez
```

This keeps resume semantics and portfolio decoration separate from the external procedural tree generator.

## Assets

Grass texture: Grass 002 from ambientCG, released under CC0.
