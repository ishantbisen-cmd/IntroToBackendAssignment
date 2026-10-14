package com.rajasoftware.leavemanagement.configuration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
public class DevProfileLogger implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevProfileLogger.class);

    private final LeaveProperties leaveProperties;

    public DevProfileLogger(LeaveProperties leaveProperties) {
        this.leaveProperties = leaveProperties;
    }

    @Override
    public void run(String... args) {
        log.info("dev profile is active. A leave request can be at most {} days.", leaveProperties.getMaxDays());
    }
}
