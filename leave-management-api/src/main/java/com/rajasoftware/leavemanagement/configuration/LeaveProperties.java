package com.rajasoftware.leavemanagement.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "leave")
public class LeaveProperties {

    /**
     * Longest leave, in calendar days, that the service will accept.
     * startDate and endDate are both counted.
     */
    private int maxDays = 30;

    public int getMaxDays() {
        return maxDays;
    }

    public void setMaxDays(int maxDays) {
        this.maxDays = maxDays;
    }
}
