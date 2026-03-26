-- Router LLM classification is now an env variable (ROUTER_LLM_CLASSIFICATION),
-- not a database feature flag. Clean up the rows.
DELETE FROM public.app_features WHERE id = 'router_llm_classification';
