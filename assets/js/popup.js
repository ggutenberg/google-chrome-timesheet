document.addEventListener('DOMContentLoaded', function() {

    const dashboardURL = 'https://dashboard.10up.com/blog/10upper/';
    let dashboardId, harvestId, harvestApiKey;
    let timesheet = {};
    let startOfWeek = '';
    let refreshStatsButton = document.getElementById( 'refresh-stats' );

    chrome.storage.local.get({
        dashboardId: '',
        harvestId: '',
        harvestApiKey: ''
    }, function(items) {
        dashboardId = items.dashboardId;
        harvestId = items.harvestId;
        harvestApiKey = items.harvestApiKey;

        checkDashboard();
    });

    const getTimesheet = function() {

        const startDate = moment( startOfWeek ).startOf('isoWeek').format( "YYYY-MM-DD" )
        const endDate   = moment( startOfWeek ).add(1, 'weeks').startOf('week').format( "YYYY-MM-DD" )

        let xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

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
                            'hours': parseFloat( el.rounded_hours )
                        };
                    }
                } );

                chrome.tabs.query( { active: true, currentWindow: true }, function( tabs ) {
                    const stringTimesheet = JSON.stringify( timesheet );
                    const weekStart = JSON.stringify( startDate );
                    chrome.tabs.executeScript( tabs[0].id, {
                        'code': `parseTimesheet(${stringTimesheet},${weekStart})`
                    } );
                } );
            }
        });

        xhr.open("GET", "https://api.harvestapp.com/v2/time_entries?from=" + startDate + '&to=' + endDate );
        xhr.setRequestHeader("Harvest-Account-Id", harvestId );
        xhr.setRequestHeader("authorization", 'Bearer ' + harvestApiKey );

        xhr.send();
    }

    const checkDashboard = function( checkTimesheet ) {

        if ( dashboardId ) {

            chrome.tabs.query({
                'active': true,
                'currentWindow': true
            }, function (tabs) {
                const regex = new RegExp(dashboardURL);
                if (!regex.test(tabs[0].url)) {
                    chrome.tabs.create({'url': dashboardURL + dashboardId + '/'});
                } else {
                    if ( checkTimesheet ) {
                        refreshStatsButton.value = 'Loading...';
                        chrome.tabs.query({
                            'active': true,
                            'currentWindow': true
                        }, function (tabs) {
                            const url = new URL(tabs[0].url);
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
                        });
                    }
                }
            } );
        } else {
            chrome.tabs.create({ url: "chrome://extensions/?options=" + chrome.runtime.id }, function() {});
        }
    };

    refreshStatsButton.addEventListener( 'click', function() {
        checkDashboard( true );
    } );

} );