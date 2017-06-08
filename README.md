# canvas-javascript-courseFullListFilter
This is a userscript designed to replace the Canvas LMS' "Courses List" with a complete filterable and paginated list.

[**Canvas LMS - REST API and Extensions Documentation**](https://canvas.instructure.com/doc/api/index.html)

#### Dependencies
- Userscript Manager
  - [Tampermonkey (Chrome)](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en)
  - [Tampermonkey (Firefox)](https://addons.mozilla.org/en-us/firefox/addon/tampermonkey/)
  - [Greasemonkey (Firefox)](https://addons.mozilla.org/en-us/firefox/addon/greasemonkey/)

#### Warning
- Because the Canvas API limits the amount of data and information that can be retrieved from a single API call, a subaccount with a lot of courses will take more time to load.
- To keep the loading time to a minimum, only the data pulled from retrieving all pages of **/api/v1/accounts/:account_id/courses** is used in generating that compiled course list.
  - **Student Count** and **Assigned Teachers** are not displayed due to this limitation

#### How-To Use
1. Load the userscript to your **Userscript Manger** of choice
2. Enabled the userscript
3. Access the "Courses List" of any subaccount in the Canvas LMS
4. Use the filters to narrow your results:
   - **Course Name**: Accepts multiple terms and compares them against the **Course Name** of all shells for matches of all terms (case-insensitive). (i.e., If you search for "WORKING 201701", it'll return "201701 Miami Working ENG480" because it contains "WORKING" ***AND*** "201701", but it won't return "201701 Miami Sandbox ENG480" because it is missing the "WORKING" term.)
   - **Term Filter**: This is literally a clone() of the default Canvas term filter, but it now serves this system (which doesn't have to reload the page when changing filters).
   - **Sort By**: Mostly a clone of the Canvas sorter, but with the ability to sort by the "Course Code", in addition to the original "Course Name" and "Creation Date" options.
   - **Display x Shells**: How many courses do you want to see per page? The default is **50**, but additional options are **10**, **25**, **100**, and **All** (**All** is not recommended for large subaccounts!).
