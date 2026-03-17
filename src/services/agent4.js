function formatHour(hour24) {
  const display = hour24 > 12 ? hour24 - 12 : hour24;
  const period = hour24 < 12 ? 'AM' : 'PM';
  return `${display}:00 ${period}`;
}

function formatBlock(startMins, durationMins) {
  const endMins = startMins + durationMins;
  const startHour24 = Math.floor(startMins / 60);
  const startMin = startMins % 60;
  const endHour24 = Math.floor(endMins / 60);
  const endMin = endMins % 60;
  const startDisplay = startHour24 > 12 ? startHour24 - 12 : startHour24;
  const endDisplay = endHour24 > 12 ? endHour24 - 12 : endHour24;
  const startPeriod = startHour24 < 12 ? 'AM' : 'PM';
  const endPeriod = endHour24 < 12 ? 'AM' : 'PM';
  return `${startDisplay}:${startMin.toString().padStart(2,'0')} ${startPeriod} - ${endDisplay}:${endMin.toString().padStart(2,'0')} ${endPeriod}`;
}

export function createEventSchedule(topMatches, attendeeAnalysis, event) {
  const schedule = [];
  
  // Extract event timing with fallbacks
  let startHour = 9; // Default 9 AM
  let endHour = 17; // Default 5 PM
  
  // Try to parse start time
  if (event.startTime || event.start_time) {
    const timeStr = event.startTime || event.start_time;
    const match = timeStr.match(/(\d+)/);
    if (match) {
      startHour = parseInt(match[1]);
      if (timeStr.toLowerCase().includes('pm') && startHour < 12) {
        startHour += 12;
      }
    }
  }
  
  // Try to parse end time
  if (event.endTime || event.end_time) {
    const timeStr = event.endTime || event.end_time;
    const match = timeStr.match(/(\d+)/);
    if (match) {
      endHour = parseInt(match[1]);
      // Handle PM times
      if (timeStr.toLowerCase().includes('pm') && endHour < 12) {
        endHour += 12;
      }
    }
  }

  const totalMinutes = (endHour - startHour) * 60;
  const sponsorCount = Math.min(topMatches.length, 4);
  const minutesPerSponsor = Math.floor(totalMinutes / (sponsorCount + 1)); // +1 for buffer
  
  let currentMinute = startHour * 60;
  const endMinute = endHour * 60;

  if (!topMatches || topMatches.length === 0) {
    return [{
      time: `${formatHour(startHour)} - ${formatHour(endHour)}`,
      activity: "Open networking",
      reason: "No specific sponsor matches — use this time to explore and connect"
    }];
  }
  
  // Visit top priority sponsors first
  topMatches.slice(0, Math.min(2, topMatches.length)).forEach((match, i) => {
    if (currentMinute + minutesPerSponsor <= endMinute) {
      schedule.push({
        time: formatBlock(currentMinute, minutesPerSponsor),
        activity: `Visit ${match.sponsor} booth`,
        reason: i === 0 
          ? "Your top match - visit first when you're most energized"
          : "High-priority match while you're still fresh"
      });
      currentMinute += minutesPerSponsor;
    }
  });
  
  // Add networking break if time permits
  const BREAK_MINS = 30;
  if (totalMinutes > 240 && currentMinute + BREAK_MINS <= endMinute) {
    schedule.push({
      time: formatBlock(currentMinute, BREAK_MINS),
      activity: "Networking break / Coffee",
      reason: "Process what you've learned and prepare for next conversations"
    });
    currentMinute += BREAK_MINS;
  }
  
  // Add remaining sponsors if time permits
  topMatches.slice(2, 4).forEach((match) => {
    if (currentMinute + minutesPerSponsor <= endMinute) {
      schedule.push({
        time: formatBlock(currentMinute, minutesPerSponsor),
        activity: `Visit ${match.sponsor} booth`,
        reason: "Strong match - good time to explore their offerings"
      });
      currentMinute += minutesPerSponsor;
    }
  });
  
  // Add follow-up time towards the end
  if (currentMinute + minutesPerSponsor <= endMinute) {
    schedule.push({
      time: formatBlock(currentMinute, minutesPerSponsor),
      activity: "Follow-up conversations / Ask remaining questions",
      reason: "Revisit sponsors to clarify or discuss next steps"
    });
  }
  
  return schedule;
}
