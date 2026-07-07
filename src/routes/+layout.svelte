<script lang="ts">
  import { onMount } from 'svelte';
  import { initAnalytics } from '$lib/analytics';

  let { children } = $props();

  onMount(() => {
    // Runs only in the browser; no-op unless PUBLIC_PLAUSIBLE_DOMAIN is set.
    initAnalytics();
  });
</script>

{@render children()}
