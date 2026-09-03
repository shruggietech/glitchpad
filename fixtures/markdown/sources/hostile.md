# Hostile Markdown Fixture

<!-- markdown-link-check-disable -->

<script>alert('inert')</script>

<img src="https://tracker.example/pixel" onerror="alert(1)" alt="hostile raw HTML image">

[JavaScript](<javascript:alert(1)>) [Data](data:text/html,owned) [File](file:///private/source) [Credentials](https://user:secret@example.com/) [Protocol relative](//example.com/path) [Bidirectional](https://example.com/‮hidden) ![Remote tracking pixel](https://tracker.example/pixel)

<!-- markdown-link-check-enable -->
