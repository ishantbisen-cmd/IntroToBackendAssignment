package com.rajasoftware.leavemanagement.repository;

import com.rajasoftware.leavemanagement.model.LeaveRequest;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class InMemoryLeaveRepository implements LeaveRepository {

    private final ConcurrentHashMap<Long, LeaveRequest> store = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(0);

    @Override
    public List<LeaveRequest> findAll() {
        return store.values().stream()
                .map(this::copy)
                .sorted(Comparator.comparing(LeaveRequest::getId))
                .toList();
    }

    @Override
    public Optional<LeaveRequest> findById(Long id) {
        LeaveRequest found = store.get(id);
        return found == null ? Optional.empty() : Optional.of(copy(found));
    }

    @Override
    public List<LeaveRequest> findByEmployeeId(String employeeId) {
        return store.values().stream()
                .filter(leave -> leave.getEmployeeId().equals(employeeId))
                .map(this::copy)
                .toList();
    }

    @Override
    public LeaveRequest save(LeaveRequest leaveRequest) {
        if (leaveRequest.getId() == null) {
            leaveRequest.setId(sequence.incrementAndGet());
        }
        LeaveRequest stored = copy(leaveRequest);
        store.put(stored.getId(), stored);
        return copy(stored);
    }

    @Override
    public boolean deleteById(Long id) {
        return store.remove(id) != null;
    }

    private LeaveRequest copy(LeaveRequest source) {
        LeaveRequest copy = new LeaveRequest();
        copy.setId(source.getId());
        copy.setEmployeeId(source.getEmployeeId());
        copy.setLeaveType(source.getLeaveType());
        copy.setStartDate(source.getStartDate());
        copy.setEndDate(source.getEndDate());
        copy.setReason(source.getReason());
        copy.setStatus(source.getStatus());
        return copy;
    }
}
