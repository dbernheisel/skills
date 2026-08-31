# Coding Standards

**Always** reference protocol sources (such as datatracker) when implementing or debugging protocols.
**Always** fix compilation errors before thinking you are done.
**Always** verify with tests before thinking you are done.
**Ask** if backwards compatibility is important

## Self-explaining code

Prefer names, small functions, and composition that express intent without comments.

Before adding an explanatory comment, try to encode the reason in a function,
predicate, or data name. Do not narrate what the code does, preserve investigation
history, or compensate for a large function with a paragraph.

Use comments only for constraints the code cannot express, such as protocol
requirements, upstream bugs, compatibility behavior, or temporary workarounds.
State the constraint briefly.
