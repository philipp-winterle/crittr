# CriticalOptimizer

**Work in progress - come back later**

## FAQ
 - Why do I need to put my css file in when I only want to extract the critical css?
    You don't need to but if you don't set your css file as an option you may not receive all vendor prefixes you may expect. This is due testing with only one browser engine which drop other prefixes.

## TODO

- wildcards
- positioning of critical css rules 
- multi selector partial matches ? needed?
- Max parallel tabs (suggested 4 to 5)
- option js disabled (test for extracting with renderTimeout)
- page crash - recover url (page.url()) and retry

## Bugs
- @charset is doubled