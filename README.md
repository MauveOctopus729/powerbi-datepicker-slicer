# Power BI Date Picker Slicer

A custom Power BI visual that adds a date picker with a dropdown of named default dates. The defaults are driven by DAX measures, so the dropdown labels and dates update dynamically with your data.

## Why

Power BI's built-in date slicer works fine for picking dates, but it has no concept of meaningful defaults. If you're working with academic terms, financial quarters, or reporting periods, you end up scrolling through a calendar trying to remember specific dates. This visual lets you define those key dates as measures and select them from a labelled dropdown.

## What it does

The visual has two field wells:

**Date Column** accepts a single date column. This is the column the slicer filters on.

**Default Dates** accepts multiple measures that return date values. Each measure's name becomes a label in the dropdown, and its value becomes the date that gets selected.

The visual automatically adds "Earliest Date" and "Latest Date" entries based on the min and max of the date column. These labels are configurable in the Format pane.

When a user selects a default from the dropdown, the date picker updates to match and a filter is applied. The user can also pick a date manually from the calendar, and the dropdown will reflect the matching default if one exists.

## Setup

You need Node.js (v18 or later) and the Power BI Visuals CLI installed globally:
```
npm install -g powerbi-visuals-tools
```

Clone this repository, install dependencies, and add the filter models library:
```
git clone https://github.com/MauveOctopus729/powerbi-datepicker-slicer.git
cd powerbi-datepicker-slicer
npm install
npm install powerbi-models
```

To package the visual:
```
pbiviz package
```

This creates a `.pbiviz` file in the `dist/` folder. Import it into Power BI Desktop via the Visualizations pane (three dots > Import a visual from a file).

## Example DAX measures

These are examples of measures you could drop into the Default Dates well:
```
Event 1 = DATE(2024, 9, 8)
Event 2 = DATE(2025, 1, 9)
Event 3 = DATE(2025, 3, 13)
```

The measure name is what appears in the dropdown, so name them descriptively.

## Format pane options

Under **General**: customise the labels for the auto-generated earliest and latest date entries, and choose a date display format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, or DD MMM YYYY).

Under **Style**: change the font, font size, text colour, accent colour, and background colour.

## Project structure
```
src/visual.ts        Main visual logic (DOM, data reading, filtering)
src/settings.ts      Format pane definitions
capabilities.json    Data wells and formatting property declarations
pbiviz.json          Visual metadata (name, GUID, author)
style/visual.less    Stylesheet
assets/icon.png      Visualizations pane icon
```

## Notes

The visual uses a BasicFilter with the "In" operator to filter the date column to a single date. If your use case needs range filtering, the BasicFilter can be swapped for an AdvancedFilter with GreaterThanOrEqual/LessThanOrEqual conditions.

Measures must return a proper Date type for the visual to read them. Text representations of dates will not work.

## Licence

MIT
