// ==UserScript==
// @name          Canvas Course Full List/Filter
// @namespace     https://github.com/cesbrandt/canvas-javascript-courseFullListFilter
// @description   Userscript designed to replace with Canvas LMS "Courses List" with a complete filterable and paginated list.
// @include       /^https?:\/\/[^\.]+\.((beta|test)\.)?instructure\.com\/accounts\/\d+$/
// @version       1.2
// @updateURL     https://raw.githubusercontent.com/cesbrandt/canvas-javascript-courseFullListFilter/master/canvasCourseFullListFilter.user.js
// ==/UserScript==

/**
 * Configuration
 */
var tabbed = false;    // Set to false to disable the Canvas-generated list
var labeled = false;   // Set to false to disable labels for new list
                       //    filtering/display options

/**
 * Variable setup
 */
var url = window.location.href;

var leveledURL = url.split('/');
var view = url.match(/\.com\/?$/) ? 'dashboard' : leveledURL[3];
view = view.match(/^\?/) ? 'dashboard' : view;
var viewID = (view !== 'dashboard' && typeof leveledURL[4] !== 'undefined') ?
	leveledURL[4] : null;

var courses, sortedList = [];

/**
 * @name          Is Object or Array Empty?
 * @description   Generic function for determing if a JavaScript object or array
 *                is empty
 * @return bool   Yes, it is empty; No, it is not empty
 */
function isEmpty(obj) {
	if(Object.prototype.toString.call(obj) == '[object Array]') {
		return obj.length > 0 ? false : true;
	} else {
		for(var key in obj) {
			if(obj.hasOwnProperty(key)) {
				return false;
			}
		}
		return true;
	}
}

/**
 * @name          API Call
 * @description   Calls the Canvas API
 * @return undefined
 */
function callAPI(context, page, getVars, oncomplete, oncompleteInput, lastPage,
				  firstCall) {
	var validContext = Object.prototype.toString.call(context);
	var callURL = url.match(/^.*(?:instructure\.com)/)[0] + '/api/v1';
	if(validContext) {
		context.forEach(function(contextLevel) {
			callURL += '/' + contextLevel;
		});
	}
	var audit = callURL.match(/audit/) !== null ? true : false;
	getVars = getVars === null ? [{}] : getVars;
	oncompleteInput = oncompleteInput === null ? function(output) {
		console.log(output);
	} : oncompleteInput;
	firstCall = typeof firstCall != 'undefined' ? firstCall : [{}];
	var expandedVars = getVars.slice(0);
	page = typeof page === 'undefined' ? (audit ? 'first' : 1) : page;
	expandedVars[0].page = page;
	expandedVars[0].per_page = 100;
	var compiledJSON = [];
	var callsToMake = [{
		callURL: callURL,
		data: $.extend(true, {}, expandedVars[0])
	}];
	if(page === 1 || audit) {
		$.when(callAJAX(callURL, expandedVars[0])).then(function(json, status,
																  xhr) {
			if(!audit) {
				if(xhr.getResponseHeader('Link') !== null) {
					var lastPage = parseInt(xhr.getResponseHeader('Link').match(
						/\bpage=(\d+\b)(?=[^>]*>; rel="last")/)[1]);
					if(page < lastPage) {
						callAPI(context, (page + 1), getVars, oncomplete,
								oncompleteInput, lastPage, json);
					} else {
						oncomplete(json, oncompleteInput);
					}
				} else {
					oncomplete(json, oncompleteInput);
				}
			} else {
				if(xhr.status != 200) {
					oncomplete({
						error: 'There was an error. Please try again.'
					});
				} else {
					var results = (firstCall.length == 1 &&
								   isEmpty(firstCall[0])) ? json.events :
									$.merge(firstCall, json.events);
					if(json.events.length === 100) {
						page = xhr.getResponseHeader('link').match(
							/\bpage=[^&]*(?=[^>]*>; rel="next")/)[0]
							.split('=')[1];
						callAPI(context, page, getVars, oncomplete,
								oncompleteInput, null, results);
					} else {
						oncomplete(results, oncompleteInput);
					}
				}
			}
		});
	} else {
		for(var i = (page + 1), j = (callsToMake.length - 1); i <= lastPage;
			i++) {
			$.merge(callsToMake, [$.extend(true, {}, callsToMake[j])]);
			callsToMake[j].data.page = i;
		}
		var allCalls = callsToMake.map((currentSettings) => {
			return callAJAX(currentSettings.callURL, currentSettings.data);
		});
		$.when.apply($, allCalls).then(function() {
			$.each(arguments, function(index, value) {
				if($.isArray(value[0])) {
					$.merge(firstCall, value[0]);
				}
			});
			oncomplete(firstCall, oncompleteInput);
		});
	}
	return;
}

/**
 * @name          AJAX Call
 * @description   Calls the the specified URL with supplied data
 * @return obj    Full AJAX call is returned for processing elsewhere
 */
function callAJAX(callURL, data) {
	return $.ajax({
		url: callURL,
		data: data
	});
}

/**
 * @name          Get Courses
 * @description   Generates a list of all courses in the current subaccount
 * @return undefined
 */
function getCourses() {
	var oncomplete = function(courses) {
		window.courses = courses;
		buildList();
	};
	callAPI([view, viewID, 'courses'], 1, [{include: ['teachers']}], oncomplete);
	return;
}

/**
 * @name          Build Course List
 * @description   Generates a list of all courses in the current subaccount
 * @return undefined
 */
function buildList() {
	for(var i = 0; i < window.courses.length; i++) {
		var course = window.courses[i];

		var teachers = '';
		for(var j = 0; j < course.teachers.length; j++) {
			teachers += (j > 0 ? (', ' + ((j === course.teachers.length - 1 && course.teachers.length > 1) ? 'and ' : '')) : '') + '<a href="' + course.teachers[j].html_url + '">' + course.teachers[j].display_name + '</a>';
		}
		teachers = teachers === '' ? 'None' : teachers;

		var state = 'Unknown';
		switch(course.workflow_state) {
			case 'unpublished':
			case 'completed':
			case 'deleted':
				state = course.workflow_state.replace(/^(.)|\s(.)/, function($1) {
					return $1.toUpperCase();
				});
				break;
			case 'available':
				state = 'Published';
				break;
		}
		var links = $('<div />')
			.addClass('ic-Table__actions')
			.html(
				'<a class="al-trigger btn btn-small" role="button" href="#">' +
					'<i class="icon-settings"></i>' +
					'<i class="icon-mini-arrow-down"></i>' +
					'<span class="screenreader-only">Actions</span>' +
				'</a>' +
				'<ul id="courseMenu-' + course.id + 'item-1" ' +
					'class="al-options" role="menu" tabindex="0" ' +
					'aria-hidden="true" aria-expanded="false" ' +
					'aria-activedescendant="courseMenu-' + course.id +
					'-item-2">' +
					'<li role="presentation">' +
						'<a href="/courses/' + course.id + '/settings" ' +
							'class="icon-settings" id="courseMenu-' +
							course.id + '-item-2" tabindex="-1" ' +
							'role="menuitem">Settings</a>' +
					'</li>' +
					'<li role="presentation">' +
						'<a href="/courses/' + course.id + '/statistics" ' +
							'class="icon-stats" id="courseMenu-' + course.id +
							'-item-3" tabindex="-1" role="menuitem">Statistics' +
							'</a>' +
					'</li>' +
				'</ul>'
			)
			.on('mousedown', function(e) {
				e.stopPropagation();
			});
		window.courses[i].courseList = $('<tr />')
			.css({
				cursor: 'pointer'
			})
			.data({
				href: '/courses/' + course.id
			})
			.html(
				'<td>' + course.id + '</td>' +
				'<td style="word-wrap: break-word;">' + course.course_code +
					'</td>' +
				'<td style="word-wrap: break-word;">' + course.name + '</td>' +
				'<td style="word-wrap: break-word;">' + teachers + '</td>' +
				'<td style="word-wrap: break-word;">' +
					(course.sis_course_id !== null ? course.sis_course_id : '') +
					'</td>' +
				'<td>' + state + '</td>' +
				'<td></td>')
			.on('mousedown', function(e) {
				if(e.which !== 3) {
					if(e.shiftKey || e.ctrlKey || e.metaKey || e.which == 2) {
						window.open($(this).data('href'), '_blank');
					} else {
						window.location = $(this).data('href');
					}
				}
			});
		window.courses[i].courseList.find('td:last').append(links);
	}
	if(tabbed) {
		convertList(0);
	} else {
		replaceList(0);
	}
	return;
}

/**
 * @name          Build Course List Table
 * @description   Builds the table to be displayed as the new list
 * @return undefined
 */
function buildListTable(page) {
	var table = $('<table />')
		.addClass('ic-Table ic-Table--hover-row')
		.html(
			'<thead>' +
				'<tr></tr>' +
				'<tr>' +
					'<th>ID</th>' +
					'<th>Course Code</th>' +
					'<th>Name</th>' +
					'<th>Teacher(s)</th>' +
					'<th>SIS ID</th>' +
					'<th>State</th>' +
					'<th>Links</th>' +
				'</tr>' +
			'</thead>' +
			'<tbody></tbody>' +
			'<tfoot></tfoot>'
		);
	$.each(window.sortedList[page], function() {
		table.find('tbody').append(this.courseList);
	});

	$('.courseList table').replaceWith(table);

	$('.courseList table thead tr:first')
		.replaceWith(generatePagination(page, 'Head'));
	$('.courseList table tfoot')
		.html('')
		.append(generatePagination(page, 'Foot'));
	return;
}

/**
 * @name          Convert Course List
 * @description   Converts the Canvas-generated list into a tabbed page with the
 *                Canvas-generated list and new list in separate tabs
 * @return undefined
 */
function convertList(page) {
	if($('#filterCourseListSubmitContainer').children().length === 0) {
		$('#filterCourseListSubmitContainer')
			.append(
				$('<a />')
					.addClass('btn btn-primary')
					.css({
						marginBottom: labeled ? 0 : '10px'
					})
					.html('<i class="icon-search"></i> Filter')
					.click(function(e) {
						e.preventDefault();
						convertList(0);
					})
			);
	}

	sortList();
	buildListTable(page);
	return;
}

/**
 * @name          Replace Course List
 * @description   Replaces the Canvas-generated list with the new list
 * @return undefined
 */
function replaceList(page) {
	if($('#filterCourseListSubmitContainer').children().length === 0) {
		$('#filterCourseListSubmitContainer')
			.append(
				$('<a />')
					.addClass('btn btn-primary')
					.html('<i class="icon-search"></i> Filter')
					.click(function(e) {
						e.preventDefault();
						replaceList(0);
					})
			);
	}

	sortList();
	buildListTable(page);
	return;
}

/**
 * @name                   Generate Course List Pagination
 * @description            Paginates the course list
 * @return jQueryElement   Pagination page bar
 */
function generatePagination(page, slot) {
	var pagination = $('<tr />')
		.html(
			'<th colspan="6"><div class="ui-buttonset"></div></th>'
		);
	var paginationTitle = 'filterCourseListPagination';
	for(var i = 0; i < window.sortedList.length; i++) {
		var pageTab = paginationTitle + i + slot;
		var active = i === page;
		pagination.find('th div').append(
			$('<input />')
				.addClass('ui-helper-hidden-accessible')
				.attr({
					type: 'radio',
					id: pageTab,
					name: paginationTitle + slot
				})
				.change(function(e) {
					replaceList(parseInt(
						$(this).attr('id').replace(/[^\d]/g, '')
					));
				})
		);
		if(active) {
			pagination.find('#' + pageTab).attr({checked: 'checked'});
		}
		pagination.find('th div').append(
			$('<label />')
				.addClass((active ? 'ui-state-active ' : '') + 'ui-button ' +
					'i-widget ui-state-default ui-button-text-only' + (i === 0 ?
					' ui-corner-left' : (i === window.sortedList.length - 1 ?
					' ui-corner-right' : '')))
			.attr({
				for: pageTab,
				role: 'button',
				ariaDisabled: 'false'
			})
			.html('<span class="ui-button-text">' + (i + 1) + '</span>')
		);
	}
	return pagination;
}

/**
 * @name          Sort/Filter Course List
 * @description   Filters then sorts the course list
 * @return undefined
 */
function sortList() {
	var filtered = window.courses.slice();
	var testTerms = $('#filterByName').val();
	if(testTerms !== '') {
		testTerms = testTerms.split(/\s+/).map(function(term) {
			return new RegExp(term, 'i');
		});
		filtered = filtered.filter(function(course) {
			return testTerms.every(function(term) {
				return term.test(course.name);
			});
		});
	}

	var testTerms = $('#filterByTeacherName').val();
	if(testTerms !== '') {
		testTerms = testTerms.split(/\s+/).map(function(term) {
			return new RegExp(term, 'i');
		});
		filtered = filtered.filter(function(course) {
			if(course.teachers.length > 0) {
				return testTerms.every(function(term) {
					return course.teachers.some(function(teacher) {
						return term.test(teacher.display_name);
					});
				});
			}
			return false;
		});
	}

	if($('#filterTermID option:selected').val() !== '') {
		filtered = $.grep(filtered, function(course) {
			return course.enrollment_term_id === parseInt(
				$('#filterTermID option:selected').val()
			);
		});
	}
	switch(parseInt($('#filterSortBy option:selected').val())) {
		case 1:
			sortBy = ['course_code', 1];
			break;
		case 2:
			sortBy = ['course_code', 2];
			break;
		case 3:
			sortBy = ['name', 1];
			break;
		case 4:
			sortBy = ['name', 2];
			break;
		case 5:
			sortBy = ['id', 1];
			break;
		default:
			sortBy = ['id', 2];
	}
	var regexAlpha = /[^a-zA-Z]/g;
	var regexNumeric = /[^0-9]/g;
	var sorted = filtered.sort(function(course1, course2) {
		course1SortBy = course1[sortBy[0]].toString().toUpperCase();
		course2SortBy = course2[sortBy[0]].toString().toUpperCase();
		var course1Numeric = parseInt(course1SortBy, 10);
		var course2Numeric = parseInt(course2SortBy, 10);

		if(isNaN(course1Numeric) && isNaN(course2Numeric)) {
			var course1Alpha = course1SortBy.replace(regexAlpha, '');
			var course2Alpha = course2SortBy.replace(regexAlpha, '');
			if(course1Alpha === course2Alpha) {
				var course1Numeric2 = parseInt(
					course1SortBy.replace(regexNumeric, ''),
					10
				);
				var course2Numeric2 = parseInt(
					course2SortBy.replace(regexNumeric, ''),
					10
				);
				return course1Numeric2 === course2Numeric2 ? 0 :
					course1Numeric2 > course2Numeric2 ? 1 : -1;
			} else {
				return course1Alpha > course2Alpha ? 1 : -1;
			}
		} else if(isNaN(course1Numeric)) {
			return 1;
		} else if(isNaN(course2Numeric)) {
			return -1;
		} else {
			return course1Numeric > course2Numeric ? 1 : -1;
		}
	});
	sorted = sortBy[1] === 1 ? sorted : sorted.reverse();
	window.sortedList = [];
	var displayLength = parseInt(
		$('#filterDisplayNumber option:selected').val()
	);
	if(displayLength === 0) {
		window.sortedList[0] = sorted;
	} else {
		var i = 0;
		for(var j = 0; j < displayLength; j++) {
			if(j === 0 && typeof window.sortedList[i] === 'undefined') {
				window.sortedList[i] = [];
			}
			window.sortedList[i].push(sorted[0]);
			sorted.splice(0, 1);
			if(j === displayLength - 1) {
				i++;
				j = -1;
			}
			if(sorted.length === 0) {
				j = displayLength - 1;
			}
		}
	}
	return;
}

(function() {
	if($('ul.courses').length > 0) {
		var contentBox = $('<div />').addClass('content-box');

		var filter = $('<div />')
			.addClass('ic-Action-header header-bar row-fluid pad-box-mini ' +
				'border border-trbl border-round-t')
			.css({
				marginBottom: 0,
				paddingBottom: 0
			})
			.html(
				'<div id="filterCourseListSelectorsContainer" class="span10">' +
					(labeled ? '<div class="item-group">' +
						'<div class="ig-header">' +
							'<h2 class="ig-header-title element_toggler" ' +
								'aria-controls="group_1" ' +
								'aria-expanded="true" ' +
								'aria-label="Filtering Options" ' +
								'role="button">' +
								'<i class="icon-mini-arrow-down"></i> ' +
								'Filtering Options' +
							'</h2>' +
						'</div>' +
						'<ul class="ig-list" id="group_1">' +
							'<li>' +
								'<div class="ig-row">' +
									'<div class="ig-row__layout">' +
										'<div class="ig-info">' +
											'<label for="filterByName" ' +
												'class="ic-Label ig-title" ' +
												'style="display: inline;">' +
												'Filter By Course Name:</label>' +
											'<div class="ig-details" ' +
												'style="display: inline;">' :
												'') +
					'<input type="text" id="filterByName" placeholder="Course ' +
						'Name"' + (labeled ? ' style="margin: 0;"' : '') + '>' +
					(labeled ?
											'</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</li>' +
							'<li>' +
								'<div class="ig-row">' +
									'<div class="ig-row__layout">' +
										'<div class="ig-info">' +
											'<label for="filterTermID" ' +
												'class="ic-Label ig-title" ' +
												'style="display: inline;">' +
												'Filter By Teacher(s):</label>' +
											'<div class="ig-details" ' +
												'style="display: inline;">' :
												'&nbsp;') +
					'<input type="text" id="filterByTeacherName" placeholder="' +
						'Teacher Name(s)"' + (labeled ? ' style="margin: 0;"' : '') + '>' +
					(labeled ?
											'</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</li>' +
							'<li>' +
								'<div class="ig-row">' +
									'<div class="ig-row__layout">' +
										'<div class="ig-info">' +
											'<label for="filterTermID" ' +
												'class="ic-Label ig-title" ' +
												'style="display: inline;">' +
												'Filter By Term:</label>' +
											'<div class="ig-details" ' +
												'style="display: inline;">' :
												'&nbsp;') +
					$('#enrollment_term_id').clone().attr({
							id: 'filterTermID'
						}).css({
							marginBottom: labeled ? 0 : '10px'
						}).wrap('<div />').parent().html() +
					(labeled ?
											'</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</li>' +
					 	'</ul>' +
					'</div>' +
					'<div class="item-group">' +
						'<div class="ig-header">' +
							'<h2 class="ig-header-title element_toggler" ' +
								'aria-controls="group_2" ' +
								'aria-expanded="true" ' +
								'aria-label="Display Options" ' +
								'role="button">' +
								'<i class="icon-mini-arrow-down"></i> ' +
								'Display Options' +
							'</h2>' +
						'</div>' +
						'<ul class="ig-list" id="group_2">' +
							'<li>' +
								'<div class="ig-row">' +
									'<div class="ig-row__layout">' +
										'<div class="ig-info">' +
											'<label for="filterSortBy" ' +
												'class="ic-Label ig-title" ' +
												'style="display: inline;">' +
												'Sort By:</label>' +
											'<div class="ig-details" ' +
												'style="display: inline;">' :
												'&nbsp;') +
					'<select id="filterSortBy"' + (labeled ?
						' style="margin: 0;"' : '') + '>' +
						'<option value="1">Course Code (A-Z)</option>' +
						'<option value="2">Course Code (Z-A)</option>' +
						'<option value="3">Name (A-Z)</option>' +
						'<option value="4">Name (Z-A)</option>' +
						'<option value="5">Oldest - Newest</option>' +
						'<option value="6" selected="selected">Newest - Oldest' +
							'</option>' +
					'</select>' +
					(labeled ?
											'</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</li>' +
							'<li>' +
								'<div class="ig-row">' +
									'<div class="ig-row__layout">' +
										'<div class="ig-info">' +
											'<label for="filterDisplayNumber" ' +
												'class="ic-Label ig-title" ' +
												'style="display: inline;">' +
												'Display #:</label>' +
											'<div class="ig-details" ' +
												'style="display: inline;">' :
												'&nbsp;') +
					'<select id="filterDisplayNumber"' + (labeled ?
						' style="margin: 0;"' : '') + '>' +
						'<option value="50" selected="selected">Display x Shells' +
							'</option>' +
						'<optgroup label="-----">' +
							'<option value="10">10</option>' +
							'<option value="25">25</option>' +
							'<option value="50">50 (Default)</option>' +
							'<option value="100">100</option>' +
						'</optgroup>' +
						'<optgroup label="-----">' +
							'<option value="0">All</option>' +
						'</optgroup>' +
					'</select>' +
					(labeled ?
											'</div>' +
										'</div>' +
									'</div>' +
								'</div>' +
							'</li>' +
					 	'</ul>' +
					'</div>' : '') +
				'</div>' +
				'<div id="filterCourseListSubmitContainer" class="span2 ' +
					'align-right"></div>');
		var list = $('<div />')
			.addClass('pad-box-mini border border-rbl border-round-b ' +
				'courseList')
			.html(
				'<table style="width: 100%;">' +
					'<thead>' +
						'<tr>' +
							'<th>' +
								'Please be patient while the course ' +
									'list loads.<br />' +
								'This may take a few minutes depending ' +
									'on how many courses fall under ' +
									'this account.' +
							'</th>' +
						'</tr>' +
					'</thead>' +
					'<tbody>' +
						'<tr>' +
							'<td style="text-align: center;">' +
								'<i id="audio_record_holder" style="' +
									'display: inline-block; ' +
									'background-position: 0; ' +
									'box-shadow: none; width: 31px; ' +
									'height: 31px; margin: 0;"></i>' +
							'</td>' +
						'</tr>' +
					'</tbody>' +
				'</table>'
			);

		if(tabbed) {
			$('#not_right_side').wrap(
				'<div id="coursesListTabs"><div id="courses-2"></div></div>'
			);
			$('#coursesListTabs').prepend(
				$('<ul />').html(
					'<li><a href="#courses-1">New List</a></li>' +
					'<li><a href="#courses-2">Old List</a></li>'
				),
				$('<div />')
					.attr({
						id: 'courses-1'
					})
			);
			$('#courses-1').append(
				filter,
				list
			);
			$('#coursesListTabs').tabs();
		} else {
			$('ul.courses').parent().find('.ui-state-highlight').remove();
			$('#right-side h2:contains("Course Filtering") ~ div:eq(0)').remove();
			$('#right-side h2:contains("Course Filtering")').remove();
			$('#right-side h2:contains("Find a Course") ~ div:eq(0)').remove();
			$('#right-side h2:contains("Find a Course")').remove();
			$('ul.courses').replaceWith(
				contentBox.append(
					filter,
					list
				)
			);
		}
	}
	getCourses();
})();
