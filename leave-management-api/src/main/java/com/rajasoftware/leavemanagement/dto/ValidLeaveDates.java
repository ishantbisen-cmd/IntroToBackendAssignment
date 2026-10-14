package com.rajasoftware.leavemanagement.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = LeaveDatesValidator.class)
public @interface ValidLeaveDates {

    String message() default "endDate must be on or after startDate";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
