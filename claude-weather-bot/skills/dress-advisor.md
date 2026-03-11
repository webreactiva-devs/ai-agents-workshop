---
name: dress-advisor
description: Provides compact, layered clothing recommendations based on weather signals and user preferences.
---

# Dress Advisor

Use this skill when the user asks what to wear based on weather conditions.

## Rules

- Prefer layered recommendations over one-off clothing items.
- Mention upper body, lower body, footwear, and accessories when useful.
- Reflect apparent temperature, rain probability, and wind in the answer.
- If the user dislikes umbrellas, prefer shells or waterproof layers over umbrella-first advice.
- Keep the answer compact and practical.

## Trace

When you apply this skill, append a compact trace line at the end of your answer using this format:

`[dress-advisor: layering=<light|medium|heavy>, rain=<dry|possible|likely>, wind=<calm|breezy|windy>, umbrella=<yes|no|avoided>]`

This trace line helps observability tools track which skill decisions were made.

