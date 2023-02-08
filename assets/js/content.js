let timesheet = [];
let startOfWeek;
let storageKey;

const dashboardURL = 'https://dashboard.10up.com/blog/10upper/';
let dashboardId, harvestId, harvestApiKey;

chrome.storage.local.get({
    dashboardId: '',
    harvestId: '',
    harvestApiKey: ''
}, function(items) {
    dashboardId = items.dashboardId;
    harvestId = items.harvestId;
    harvestApiKey = items.harvestApiKey;
    checkDashboard( true );
});

const importModule = function ( file ) {
    const script = document.createElement('script');
    script.setAttribute('type', 'module');
    script.setAttribute('src', chrome.runtime.getURL( file ));
    const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    head.insertBefore( script, head.lastChild );
}

const getCookie = function( name ) {
    const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
};

const setCookie = function( name, value, days ) {
    let d = new Date();
    d.setTime( d.getTime() + 24 * 60 * 60 * 1000 * days );
    document.cookie = name + "=" + value + ";path=/;expires=" + d.toGMTString();
};

const markupCleanup = function () {
    // get Content Div
    const contentDiv  = document.getElementById("buc-content");
    const maintime    = contentDiv.querySelector('.employee-schedule-overview');
    const empRefresh  = document.querySelector('.employee-refresh');

    let mappingButton = document.createElement("a");
    mappingButton.setAttribute( 'ID', 'mapping');
    mappingButton.innerHTML = 'Manually Map';

    let refreshStatsButton = document.createElement("input");
    refreshStatsButton.setAttribute( 'ID', 'refresh-stats');
    refreshStatsButton.setAttribute( 'class', 'refresh-stats');
    refreshStatsButton.setAttribute( 'type', 'button');
    refreshStatsButton.setAttribute( 'value', 'Refresh Stats');

    // create content container/wrapper
    let infoContainer = document.createElement("div"); 
    infoContainer.className = 'employee-info-container'; 
    
    // add to the content div
    contentDiv.insertAdjacentElement( 'beforeend', infoContainer ); 

    infoContainer.appendChild( maintime );
    empRefresh.insertAdjacentElement( 'beforeend', mappingButton );
    empRefresh.insertAdjacentElement( 'beforeend', refreshStatsButton );

    // attach listener to refresh
    refreshStatsButton.addEventListener( 'click', function() {
        checkDashboard( true );
    } );
}

const parseTimesheet = function( timeEntries, startDate ) {
    startOfWeek = startDate;
    // reset everything.
    [].forEach.call(document.querySelectorAll('.employee-client-hours-logged'),function(e){
        e.parentNode.removeChild(e);
    });

    let resourcing = document.querySelectorAll( '.employee-schedule-row' );

    if( ! Array.isArray( timeEntries ) ) {
        timesheet = Object.values(timeEntries);
    } else {
        timesheet = timeEntries;
    }

    window.timesheet = timesheet; 

    setCookie( 'mapping-' + startOfWeek, JSON.stringify( timesheet ), 365 );
    storageKey = 'mapping-' + startOfWeek;
    let totalHoursLogged = 0;
    let totalHoursMapped = 0;
    timesheet.forEach( function( p ) {
        totalHoursLogged += p.hours;
    } );

    chrome.storage.local.get( {
        [storageKey]: false,
    }, function( items ) {

        resourcing.forEach( function( el, index )  {
            if ( 0 === index ) {
                // add the hours logged column.
                el.insertAdjacentHTML( 'beforeend', '<div class="employee-cell employee-client-hours-logged" style="position: relative;">Hours logged</div>' );
                document.getElementById( 'mapping' ).addEventListener( 'click', mapEntries );
            } else {
                // see if we can find the project.
                const project = el.querySelector( '.employee-client-project,.employee-schedule-total-label' );
                let hours_logged = 0;
                if ( project && 'Total' !== project.innerHTML ) {
                    const project_name = project.innerHTML;
                    timesheet.forEach( function( p ) {
                        if ( compareNames( project_name, p.project ) ) {
                            hours_logged = p.hours;
                        } else {
                            // check mapping.
                            const current_project = p;
                            if ( items[storageKey]['project[' + project_name.replace( '&amp;', '&' ) + '][]'] ) {
                                if ( Array.isArray( items[storageKey]['project[' + project_name.replace( '&amp;', '&' ) + '][]'] ) ) {
                                    items[storageKey]['project[' + project_name.replace( '&amp;', '&' ) + '][]'].forEach( function( map_item ) {
                                        if ( map_item === `cpt${current_project.client_id}-${current_project.project_id}-${current_project.task_id}` ) {
                                            hours_logged = hours_logged + parseFloat( current_project.hours );
                                        }
                                    } );
                                } else {
                                    if( items[storageKey]['project[' + project_name.replace( '&amp;', '&' ) + '][]'] === `cpt${current_project.client_id}-${current_project.project_id}-${current_project.task_id}` ) {
                                        hours_logged = hours_logged + parseFloat( current_project.hours );
                                    }
                                }

                            }
                        }
                    } );
                }
                // check if last row.
                if ( ! resourcing[index+1] ) {
                    hours_logged = totalHoursLogged;
                    if ( hours_logged != totalHoursMapped ) {
                        hours_logged = parseFloat( hours_logged ).toFixed( 2 ) + ' mapped: ' + parseFloat( totalHoursMapped ).toFixed( 2 );
                    }
                } else {
                    totalHoursMapped += hours_logged;
                }
                el.insertAdjacentHTML( 'beforeend', '<div class="employee-cell employee-client-hours-logged">' + parseFloat( hours_logged ).toFixed( 2 ) + '</div>' );
            }
        } );

        remaining();
    } );
};

const mapEntries = function( e ) {
    e.preventDefault();

    chrome.storage.local.get( {
        [storageKey]: {}
    }, function( items ) {

		// get all project names AND any holidays or other extra things resourced to.
        let resourcing = document.querySelectorAll( '.employee-client-project,.employee-schedule-total-label' );
        let output = '<div id="mapping_content"><form id="form_mapping">';
        resourcing.forEach( function( el, index )  {
            // see if we can find the project.
            const project = 'Total' !== el.innerHTML ? el : false;
            if ( project ) {
                const project_name = project.innerHTML.replace( '&amp;', '&' );
                output += '<div><label>' + project_name + ':</label><select name="project[' + project_name + '][]" multiple size="5">';
                timesheet.forEach( function( p ) {
					output += '<optgroup label="' + p.project.replace( '&amp;', '&' ) + '">';
                    output += '<option value="' + `cpt${p.client_id}-${p.project_id}-${p.task_id}` + '"';
                    // check mapping.
                    if ( items[storageKey]['project[' + project_name + '][]'] ) {
                        if ( Array.isArray( items[storageKey]['project[' + project_name + '][]'] ) ) {
                            items[storageKey]['project[' + project_name + '][]'].forEach(function (map_item) {
                                if ( map_item === `cpt${p.client_id}-${p.project_id}-${p.task_id}` ) {
                                    output += ' selected';
                                }
                            });
                        } else {
                            if( items[storageKey]['project[' + project_name + '][]'] === `cpt${p.client_id}-${p.project_id}-${p.task_id}` ) {
                                output += ' selected';
                            }
                        }
                    }
					output += '>' + p.task.replace( '&amp;', '&' ) + '</option>';
					output += '</optgroup>';
                } );
                output += '</select></div><br>';
            }
        } );
        output += '<input type="submit" value="Save mapping"></form></div>';

        document.getElementById( 'mapping' ).insertAdjacentHTML('afterEnd', output );
        document.getElementById( 'form_mapping' ).addEventListener( 'submit', function( e ) {
            e.preventDefault();

            var object = {};
            var formData = new FormData( e.target );
            formData.forEach((value, key) => {
                // Reflect.has in favor of: object.hasOwnProperty(key)
                if(!Reflect.has(object, key)){
                    object[key] = value;
                    return;
                }
                if(!Array.isArray(object[key])){
                    object[key] = [object[key]];
                }
                object[key].push(value);
            });
           chrome.storage.local.set( {
               [storageKey]: object
           }, function( items ) {
               parseTimesheet( timesheet, startOfWeek );
           } );
            return false;
        } );

    } );

    return false;
};

const init = function() {
    let startOfWeek;
    const url = new URL( document.location.href );
    const arg = url.searchParams.get( 'week' );

    markupCleanup();

    if ( arg ) {
        startOfWeek = arg;
    } else {
        startOfWeek = moment().format( "YYYY-MM-DD" );
    }

    if( 0 === moment( startOfWeek ).day() ) {
        startOfWeek = moment( startOfWeek ).add( 1, 'days' ).format( 'YYYY-MM-DD' );
    }

    const startDate = moment( startOfWeek ).startOf( 'isoWeek' ).format( 'YYYY-MM-DD' );

    // parseTimesheet on init
    try {
        const timeSheet = JSON.parse( getCookie( 'mapping-' + startDate ) );
        if ( timeSheet ) {
            parseTimesheet( timeSheet, startDate );
        }
    } catch ( e ) {
        // do nothing.
    }
};


const getTimesheet = function() {

    const startDate = moment( startOfWeek ).startOf('isoWeek').format( "YYYY-MM-DD" )
    const endDate   = moment( startOfWeek ).add(1, 'weeks').startOf('week').format( "YYYY-MM-DD" )

    let xhr = new XMLHttpRequest();
    xhr.withCredentials = false;

    timesheet = {};

    xhr.addEventListener("readystatechange", function() {
        if( this.readyState === 4 ) {
            const timeEntries = JSON.parse( this.responseText );
            timeEntries.time_entries.forEach( function( el ) {

                if ( typeof timesheet['cp' + el.client.id + '-' + el.project.id ] !== 'undefined' ) {
                    timesheet['cp' + el.client.id + '-' + el.project.id ].hours = timesheet['cp' + el.client.id + '-' + el.project.id ].hours + parseFloat( el.rounded_hours );
                } else {
                    timesheet['cp' + el.client.id + '-' + el.project.id ] = {
                        'client': el.client.name,
                        'client_id': el.client.id,
                        'project_id': el.project.id,
                        'project': el.project.name,
                        'hours': parseFloat( el.rounded_hours ),
                    };
                }
            } );

            const stringTimesheet = timesheet;
            const weekStart = JSON.stringify( startDate );

            // parse timesheet after getting data.
            parseTimesheet( stringTimesheet, weekStart );
        }
    });

    xhr.open("GET", "https://api.harvestapp.com/v2/time_entries?from=" + startDate + '&to=' + endDate, true );
    xhr.setRequestHeader("Harvest-Account-Id", harvestId );
    xhr.setRequestHeader("authorization", 'Bearer ' + harvestApiKey );

    xhr.send();
}

const checkDashboard = function( checkTimesheet ) {
    let refreshStatsButton = document.getElementById( 'refresh-stats' );

    if ( dashboardId ) {

        const url = new URL( document.location.href );
        const regex = new RegExp(dashboardURL);

        if (!regex.test(url)) {
            chrome.tabs.create({'url': dashboardURL + dashboardId + '/'});
        } else {
            if ( checkTimesheet ) {
                refreshStatsButton.value = 'Loading...';
                const arg = url.searchParams.get('week');
                if (arg) {
                    startOfWeek = arg;
                } else {
                    startOfWeek = moment().format( "YYYY-MM-DD" );
                }

                if( 0 === moment( startOfWeek ).day() ) {
                    startOfWeek = moment(startOfWeek).add( 1, 'days' ).format( 'YYYY-MM-DD' );
                }

                getTimesheet();
                refreshStatsButton.value = 'Refresh Stats';
            }
        }
    }
};

const cleanName = function( name ) {
    if ( !name ) {
        return '';
    }

    let n = name.replace( /[^A-Za-z\s\-]/g, ' ' );
    n = n.replace( /\-/g, ' ' );
    n = n.replace( /\s\s+/g, ' ');
    let m;
    let output = '';
    const regex = /\b\w{3,}/g;

    while ( ( m = regex.exec( n ) ) !== null ) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        // The result can be accessed through the `m`-variable.
        m.forEach( ( match, groupIndex) => {
            output += ' ' + match;
        } );
    }

    output = output.replace( /\s+/g, '' ).toLowerCase();

    return output;
};

const compareNames = function( original, logged ) {
  original = cleanName( original );
  logged   = cleanName( logged );

  // hardcoded the company time.
  if ( 'overhead' === original &&
     'companytimeplanningbrainstorming' === logged ) {
      return true;
  }

  if ( original === logged ) {
      return true;
  }

  if ( -1 !== original.indexOf( logged ) ) {
      return true;
  }

  if ( -1 !== logged.indexOf( original ) ) {
      return true;
  }

  return false;
};

const remaining = function() {
    const clientList = document.querySelectorAll('.employee-schedule-row');

    clientList.forEach( function( el, index ) {
        const clientName  = el.querySelector('.employee-client-name .employee-client-project');
        let resourcedTime = el.querySelector('.employee-client-hours');
        let usedTime      = el.querySelector('.employee-client-hours-logged');
        let remainingTime = el.querySelector('.employee-client-hours-remaining');

        if ( remainingTime ) {
            remainingTime.remove();
        }

        // we have used time, and resourced time already, we can calculate with these fields.
        if( usedTime && resourcedTime ) {
            usedTime      = parseFloat( usedTime.textContent );
            resourcedTime = parseFloat( resourcedTime.textContent );

            const remainingTime = resourcedTime - usedTime;

            // if we have a client name, then we can calculate remaining time.
            if ( clientName ) {
                let classList = 'employee-cell employee-client-hours-remaining ';
                if ( remainingTime >= 1 ){
                    // still have remaining time
                    classList += 'green-cell';
                } else if ( remainingTime > 0 && remainingTime < 1 ){
                    // getting close
                    classList += 'yellow-cell';
                } else if ( remainingTime < 0 ) {
                    // AT or Over
                    classList += 'red-cell';
                }
                el.insertAdjacentHTML( 'beforeend', '<div class="' + classList + '">' + parseFloat( remainingTime ).toFixed( 2 ) + '</div>' );
            } else {
                el.insertAdjacentHTML( 'beforeend', '<div class="employee-cell employee-client-hours-remaining" style="position: relative;">Hours Remaining</div>' );
            }
        } else {
            let resourcedTime = el.querySelector('.employee-schedule-total');
            let usedTime      = el.querySelector('.employee-client-hours-logged');
            usedTime      = parseFloat( usedTime.textContent );
            resourcedTime = parseFloat( resourcedTime.textContent );
            const remainingTime = resourcedTime - usedTime;

            el.insertAdjacentHTML( 'beforeend', '<div class="employee-cell employee-client-hours-remaining">' + parseFloat( remainingTime ).toFixed( 2 ) + '</div>' );
        }
    });

    return;
};

if ( document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll) ) {
    init();
} else {
    document.addEventListener("DOMContentLoaded", init);
}
