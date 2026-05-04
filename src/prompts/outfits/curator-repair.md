Repair an invalid outfit curation JSON response.

Return only valid JSON. Do not include markdown or explanatory text.

Use this exact JSON shape:
{
  "recommendations": [
    {
      "candidate_id": "candidate:top-id:bottom-id:footwear-id",
      "title": "Relaxed Dinner Fit",
      "reason": "The shirt and chinos keep it smart casual, while sneakers make it relaxed.",
      "styling_notes": ["Keep the shirt untucked for a casual dinner."]
    }
  ]
}

Rules:
- Use only candidate IDs from curation_input.allowed_candidate_ids.
- Return at most curation_input.desired_recommendation_count recommendations.
- Remove any duplicate recommendations.
- Do not invent candidate IDs, item IDs, wardrobe items, scores, ranks, categories, or outfit slots.
- Do not add extra clothing slots, accessories, or extra items.
- Preserve the backend candidate contents by selecting candidate_id only.
- Fix validation errors while keeping explanations concise and grounded in curation_input.ranked_candidates.
