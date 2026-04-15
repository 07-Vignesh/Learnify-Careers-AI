"use client"

import mentors from "../../data/mentors";
import MentorCard from "../../components/ui/mentor-card";


const MentorsPage = () => {
  return (
    <section className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold md:text-5xl">
          Meet Our Mentors
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Learn from industry experts who have guided hundreds of professionals
          to success.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
        {mentors.map((mentor) => (
          <MentorCard key={mentor.id} mentor={mentor} />
        ))}
      </div>
    </section>
  );
};

export default MentorsPage;
